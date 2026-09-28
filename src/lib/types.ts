import type { DepType } from "@prisma/client";

/** A dependency parsed from a file (npm package or Maven artifact). */
export interface ParsedDependency {
  name: string;
  version: string;
  type: DepType; // "NPM" | "MAVEN"
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
export type UploadKind = "package.json" | "pom.xml" | "docker-compose.yml";
