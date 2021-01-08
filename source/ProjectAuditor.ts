import { getPluginConfiguration } from "@yarnpkg/cli";
import { Configuration, Project, Workspace } from "@yarnpkg/core";
import { PortablePath } from "@yarnpkg/fslib";
import { FreshnessCatalog } from "./FreshnessCatalog";
import { WorkspaceAuditor, WorkspaceReport } from "./WorkspaceAuditor";

/**
 * The options that can be passed to an `audit` call.
 */
export type AuditOptions = {
  /**
   * Should workspaces be audited sequentially, instead of
   * all at once?
   */
  sequential: boolean;
};

/**
 * A collection of workspace reports.
 */
export type ProjectReport = Map<Workspace, WorkspaceReport>;

/**
 * Audits an entire project area for workspaces that have changed since
 * a previous run of the auditor (or yarn.build, actually).
*/
export class ProjectAuditor {
  private _project: Project;
  private _targets: Array<PortablePath>;

  /**
   * Constructs a new `ProjectAuditor`.
   * @param project The project to audit.
   * @param targets The workspaces to audit in the project. If omitted, all workspaces are audited.
   * These should be the `relativeCwd` of the workspace to target.
   * @see forProjectPath
  */
  constructor(project: Project, targets: Array<PortablePath> = []) {
    this._project = project;
    this._targets = targets;
  }

  /**
   * Construct a new auditor for a given path (where a yarn project should reside).
   * @param projectPath The path where the project is located.
   */
  static async forProjectPath(projectPath: PortablePath): Promise<ProjectAuditor> {
    const pluginConfiguration = getPluginConfiguration();
    const configuration = await Configuration.find(projectPath, pluginConfiguration);
    const projectFindResult = await Project.find(configuration, projectPath);

    if (!projectFindResult.project) {
      throw new Error("unable to find project");
    }
    const targets = new Array<PortablePath>();
    if (projectFindResult.workspace) {
      if (projectFindResult.workspace === projectFindResult.project.topLevelWorkspace) {
        targets.push(
          ...projectFindResult.project.workspaces.map(workspace => workspace.relativeCwd)
        );
      } else {
        targets.push(projectFindResult.workspace.relativeCwd);
      }
    }
    return new ProjectAuditor(projectFindResult.project, targets);
  }

  /**
   * Audit the project and return a report of the results.
   * @param options Control the auditting process through these options.
  */
  async audit(options: AuditOptions = { sequential: true }): Promise<ProjectReport> {
    await this._project.restoreInstallState();

    const freshnessCatalog = new FreshnessCatalog();
    await freshnessCatalog.loadYarnBuildState(this._project.configuration);

    const pendingAudits = new Map<Workspace, Promise<WorkspaceReport>>();
    const reports = new Map<Workspace, WorkspaceReport>();
    for (const workspace of this._project.workspaces) {
      if (workspace === this._project.topLevelWorkspace) {
        continue;
      }

      if (!this._targets.includes(workspace.relativeCwd)) {
        continue;
      }

      const workspaceAuditor = new WorkspaceAuditor(workspace);
      const pendingAudit = workspaceAuditor.audit(freshnessCatalog);
      pendingAudits.set(workspace, pendingAudit);

      if (options.sequential) {
        await pendingAudit;
      }
    }

    for (const [workspace, pendingReport] of pendingAudits) {
      const report = await pendingReport;
      reports.set(workspace, report);
    }

    return reports;
  }
}
