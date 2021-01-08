import { Workspace } from "@yarnpkg/core";
import { ProjectReport } from "./ProjectAuditor";
import { WorkspaceReport } from "./WorkspaceAuditor";

export type BuildInstruction = {
  workspace: Workspace;
};

export class ReportInspector {
  private _report: ProjectReport;

  constructor(report: ProjectReport) {
    this._report = report;
  }

  unroll(): Array<BuildInstruction> {
    const instructions = new Array<BuildInstruction>();
    for (const [workspace, workspaceReport] of this._report) {
      this._unrollWorkspaceReport(workspaceReport, instructions);
    }
    return instructions;
  }

  private _unrollWorkspaceReport(
    workspaceReport: WorkspaceReport,
    instructions: Array<BuildInstruction>
  ): void {
    if (workspaceReport.loopsBackToParent) {
      return;
    }

    if (workspaceReport.isFresh) {
      return;
    }

    if (!workspaceReport.dependenciesWereFresh) {
      // Build us.
      instructions.push({
        workspace: workspaceReport.workspace,
      });

      // And the dependencies that caused this.
      for (const [dependency, dependencyReport] of workspaceReport.dependencies) {
        this._unrollWorkspaceReport(dependencyReport, instructions);
      }
    } else if (!workspaceReport.filesWereFresh) {
      instructions.push({
        workspace: workspaceReport.workspace,
      });
    }
  }
}
