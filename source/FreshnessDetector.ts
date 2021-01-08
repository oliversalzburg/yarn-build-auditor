import { Workspace } from "@yarnpkg/core";
import { PortablePath, xfs } from "@yarnpkg/fslib";

export class FreshnessDetector {
  private _workspace: Workspace;

  constructor(workspace: Workspace) {
    this._workspace = workspace;
  }

  async isFresh(lastModified: number): Promise<boolean> {
    // TODO: This needs to come from configuration.
    const sourceDirectory = xfs.pathUtils.join(this._workspace.cwd, "source" as PortablePath);

    const timeSource = await this._getLastModifiedForFolder(sourceDirectory);

    const changeAge = lastModified - timeSource;

    return changeAge === 0;
  }

  private async _getLastModifiedForFolder(
    folder: PortablePath,
    ignore?: PortablePath | undefined
  ): Promise<number> {
    let lastModified = 0;

    const files = await xfs.readdirPromise(folder);

    for (const file of files) {
      const filePath = xfs.pathUtils.join(folder, file);
      const stat = await xfs.statPromise(filePath);
      if (stat.isFile()) {
        if (stat.mtimeMs > lastModified) {
          lastModified = stat.mtimeMs;
        }
      }
      if (stat.isDirectory()) {
        const folderLastModified = await this._getLastModifiedForFolder(filePath, ignore);

        if (folderLastModified > lastModified) {
          lastModified = folderLastModified;
        }
      }
    }

    return lastModified;
  }
}
