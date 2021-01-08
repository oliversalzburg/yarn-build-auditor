import { Configuration, Workspace } from "@yarnpkg/core";
import { Filename, PortablePath, xfs } from "@yarnpkg/fslib";
import { FreshnessDetector } from "./FreshnessDetector";

export type YarnBuildState = {
  packages: {
    [index: string]: {
      lastModified: number;
    };
  };
};

export class FreshnessCatalog {
  private _catalog = new Map<Workspace, boolean>();
  private _previousState: YarnBuildState | undefined;

  async loadYarnBuildState(configuration: Configuration): Promise<void> {
    this._previousState = await xfs.readJsonPromise(
      xfs.pathUtils.resolve(
        configuration.get("cacheFolder"),
        ".." as PortablePath,
        "yarn.build.json" as Filename
      )
    );
  }

  wasChecked(workspace: Workspace): boolean {
    return this._catalog.has(workspace);
  }

  /**
   * Determine if a given workspace has had any changes since last audit.
   */
  async isFresh(workspace: Workspace): Promise<boolean> {
    if (this._catalog.has(workspace)) {
      return this._catalog.get(workspace) as boolean;
    }

    let lastModified = new Date().getTime();
    const yarnBuildKey = `${workspace.relativeCwd}#build`;
    if (this._previousState && yarnBuildKey in this._previousState.packages) {
      lastModified = this._previousState.packages[yarnBuildKey].lastModified;
    }

    const detector = new FreshnessDetector(workspace);
    const isFresh = await detector.isFresh(lastModified);
    this._catalog.set(workspace, isFresh);
    return isFresh;
  }
}
