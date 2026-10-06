import type { DepType } from "@prisma/client";

/** A dependency parsed from a file (npm package, Maven artifact, or Python package). */
export interface ParsedDependency {
  name: string;
  version: string;
  type: DepType; // "NPM" | "MAVEN" | "PYTHON"
}

/** A container parsed from a docker-compose file. */
export interface ParsedContainer {
  image: string;
  tag: string;
}

/** The structured result of parsing an uploaded project file. */
export interface ParsedProject {
  dependencies: ParsedDependency[];
  containers: ParsedContainer[];
}

/** Supported upload file kinds. */
export type UploadKind = "package.json" | "pom.xml" | "requirements.txt" | "docker-compose.yml";
