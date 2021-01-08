import { Configuration, Workspace } from "@yarnpkg/core";
import { Filename, PortablePath, xfs } from "@yarnpkg/fslib";
import { FreshnessDetector } from "./FreshnessDetector";

/**
 * Surrogate for the yarn.build state file structure.
 */
export type YarnBuildState = {
  packages: {
    [index: string]: {
      lastModified: number;
    };
  };
};

/**
 * The catalog holds freshness information and serves as a cache.
 */
export class FreshnessCatalog {
  private _catalog = new Map<Workspace, boolean>();
  private _previousState: YarnBuildState | undefined;

  /**
   * Load the state from the yarn.build.json state file.
   * @param configuration The configuration of the project.
   */
  async loadYarnBuildState(configuration: Configuration): Promise<void> {
    this._previousState = await xfs.readJsonPromise(
      xfs.pathUtils.resolve(
        configuration.get("cacheFolder"),
        ".." as PortablePath,
        "yarn.build.json" as Filename
      )
    );
  }

  /**
   * Check if a given workspace was already checked for freshness.
   * @param workspace The workspace to check.
   */
  wasChecked(workspace: Workspace): boolean {
    return this._catalog.has(workspace);
  }

  /**
   * Determine if a given workspace has had any changes since last audit.
   * @param workspace The workspace to check for freshness.
   */
  async isFresh(workspace: Workspace): Promise<boolean> {
    // If it was already checked, return cached result.
    if (this.wasChecked(workspace)) {
      return this._catalog.get(workspace) as boolean;
    }

    // Read the last timestamp from the build state, if possible.
    let lastModified = new Date().getTime();
    const yarnBuildKey = `${workspace.relativeCwd}#build`;
    if (this._previousState && yarnBuildKey in this._previousState.packages) {
      lastModified = this._previousState.packages[yarnBuildKey].lastModified;
    }

    // Run the freshness check on the workspace.
    const detector = new FreshnessDetector(workspace);
    const isFresh = await detector.isFresh(lastModified);
    this._catalog.set(workspace, isFresh);
    return isFresh;
  }
}
