import { Descriptor, Ident, Workspace } from "@yarnpkg/core";
import { FreshnessCatalog } from "./FreshnessCatalog";

/**
 * Contains all the information that was collected during an
 * auditing run of a workspace.
 */
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

/**
 * Audits a single workspace for freshness - if there have been changes since
 * a given point in time.
*/
export class WorkspaceAuditor {
  private _workspace: Workspace;

  /**
   * Constructs a new `WorkspaceAuditor`
   * @param workspace The workspace to audit.
   */
  constructor(workspace: Workspace) {
    this._workspace = workspace;
  }

  /**
   * Audit the workspace for freshness and return a report of the findings.
   * @param freshnessCatalog A freshness cache to speed up the process.
   */
  async audit(freshnessCatalog: FreshnessCatalog): Promise<WorkspaceReport> {
    const report = new WorkspaceReport(this._workspace);

    const workspaceIsFresh = await this._auditDependencyWorkspace(
      this._workspace,
      freshnessCatalog,
      new Array<Descriptor>(),
      report
    );
    report.isFresh = workspaceIsFresh;

    return report;
  }

  /**
   * Audit the workspaces our main workspace depends upon.
   * This way we can recursively determine if the entire branch of the project
   * tree is fresh or not.
   * @param workspace The workspace to audit.
   * @param freshnessCatalog The freshness cache.
   * @param path The path on the dependency tree that we're currently traversing.
   * @param report The report for the current workspace.
  */
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
    }

    return report.dependenciesWereFresh && report.filesWereFresh;
  }
}
