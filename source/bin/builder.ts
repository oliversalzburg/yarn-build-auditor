import { PortablePath } from "@yarnpkg/fslib";
import path from "path";
import { ProjectAuditor } from "../ProjectAuditor";
import { ReportInspector } from "../ReportInspector";

const argPath = process.argv[2];

(async () => {
  const targetPath = path.resolve(argPath || process.cwd());
  const projectAuditor = await ProjectAuditor.forProjectPath(targetPath as PortablePath);
  const projectReport = await projectAuditor.audit();

  for (const [workspace, report] of projectReport) {
    if (typeof report.isFresh === "undefined") {
      throw new Error("invalid report");
    }
    if (report.isFresh) {
      console.log(`${workspace.relativeCwd} is fresh`);
    } else {
      console.warn(`${workspace.relativeCwd} needs to be rebuilt`);
      if (!report.filesWereFresh) {
        console.debug("  files in workspace changed");
      }
      if (!report.dependenciesWereFresh) {
        console.debug("  files in dependencies changed");
      }
    }
  }

  const inspector = new ReportInspector(projectReport);
  const instructions = inspector.unroll();
  for (const instruction of instructions) {
    console.log(`Build ${instruction.workspace.relativeCwd}`);
  }
})();
