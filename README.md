# yarn.build Workspace Auditing Candidate

## Abstract

We want to have a module that reliably determines if workspaces in the project area need to be rebuilt.

## Approach

The candidate will generate a report, which holds all information to fully assess the state of the entire project area.

## Components

1. `ProjectAuditor`
	Audits and reports the state of the entire project area. Utilizes `WorkspaceAuditor`.

2. `WorkspaceAuditor`
	Audits and reports the state of a single workspace. Utilizes `FreshnessCatalog`.

3. `FreshnessCatalog`
	Keeps track of the state of workspaces during an audit. Utilizes `FreshnessDetector` to retrieve freshness information.

4. `FreshnessDetector`
	Determines if a workspace has to be rebuilt.

5. `ReportInspector`
	A sample inspection implementation for a project report.

`bin/builder.ts` serves as a simple entrypoint for testing.

## Notes
Currently hardcodes the source directory as `source`.