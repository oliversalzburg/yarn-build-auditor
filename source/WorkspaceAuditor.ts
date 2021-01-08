import { Descriptor, Ident, Workspace } from "@yarnpkg/core";
import { FreshnessCatalog } from "./FreshnessCatalog";

export class WorkspaceReport {
  workspace: Workspace;
  isFresh: boolean | undefined = undefined;
  loopsBackToParent: boolean | undefined = undefined;
  dependenciesWereFresh: boolean | undefined = undefined;
  filesWereFresh: boolean | undefined = undefined;
  fileFreshnessFromCache: boolean | undefined = undefined;
  dependencies = new Map<string, WorkspaceReport>();

  constructor(workspace: Workspace) {
    this.workspace = workspace;
  }
}

export class WorkspaceAuditor {
  private _workspace: Workspace;

  constructor(workspace: Workspace) {
    this._workspace = workspace;
  }

  async audit(freshnessCatalog: FreshnessCatalog): Promise<WorkspaceReport> {
    const report = new WorkspaceReport(this._workspace);

    //console.debug(`? Auditing ${this._renderWorkspaceName(this._workspace.manifest.name)}...`);

    const workspaceIsFresh = await this._auditDependencyWorkspace(
      this._workspace,
      freshnessCatalog,
      new Array<Descriptor>(),
      report
    );
    report.isFresh = workspaceIsFresh;

    //console.debug(`! Workspace is ${workspaceIsFresh ? "fresh" : "dirty"}`);
    //console.debug(``);

    return report;
  }

  private async _auditDependencyWorkspace(
    workspace: Workspace,
    freshnessCatalog: FreshnessCatalog,
    path: Array<Descriptor>,
    report: WorkspaceReport
  ): Promise<boolean> {
    // Assume fresh until checked.
    report.isFresh = true;

    // Check our own files.
    report.fileFreshnessFromCache = freshnessCatalog.wasChecked(workspace);
    const isFresh = await freshnessCatalog.isFresh(workspace);
    report.filesWereFresh = isFresh;
    if (!isFresh) {
      // Our workspace has changed since the last audit.
      report.isFresh = false;
    }

    // Check dependency workspaces.
    report.dependenciesWereFresh = true;
    for (const descriptor of workspace.dependencies.values()) {
      const dependencyWorkspace = this._workspace.project.tryWorkspaceByDescriptor(descriptor);

      if (!dependencyWorkspace) {
        continue;
      }

      const dependencyReport = new WorkspaceReport(dependencyWorkspace);
      report.dependencies.set(workspace.relativeCwd, dependencyReport);

      if (path.includes(descriptor)) {
        // console.warn(
        //   `${this._indent(path.length + 1)}${this._renderWorkspaceName(
        //     workspace.manifest.name
        //   )} → ${descriptor.name} loops back`
        // );
        dependencyReport.loopsBackToParent = true;
        continue;
      }
      dependencyReport.loopsBackToParent = false;

      path.push(descriptor);
      const isDependencyFresh = await this._auditDependencyWorkspace(
        dependencyWorkspace,
        freshnessCatalog,
        path,
        dependencyReport
      );
      path.pop();

      dependencyReport.dependenciesWereFresh = isDependencyFresh;

      if (!isDependencyFresh) {
        // Some of the files in the dependency workspace, or its nested
        // dependency workspaces, are not fresh. So we're not fresh either.
        dependencyReport.isFresh = false;
        report.dependenciesWereFresh = false;
      }

      dependencyReport.fileFreshnessFromCache = freshnessCatalog.wasChecked(dependencyWorkspace);

      const isFresh = await freshnessCatalog.isFresh(dependencyWorkspace);
      dependencyReport.filesWereFresh = isFresh;
      if (!isFresh) {
        // Our workspace has changed since the last audit.
        dependencyReport.isFresh = false;
        report.dependenciesWereFresh = false;
      }

      // console.debug(
      //   `${this._indent(path.length + 1)}${this._renderWorkspaceName(workspace.manifest.name)} → ${
      //     descriptor.name
      //   } fresh`
      // );
    }

    return report.dependenciesWereFresh && report.filesWereFresh;
  }

  private _renderWorkspaceName(name: Ident | null): string {
    if (!name) {
      throw new Error("missing name");
    }

    if (name.scope) {
      return `@${name.scope}/${name.name}`;
    }

    return name.name;
  }

  private _indent(depth: number): string {
    return "  ".repeat(depth);
  }
}
