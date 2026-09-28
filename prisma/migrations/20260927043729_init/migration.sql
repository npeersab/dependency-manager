-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Dependency" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "latestVersion" TEXT,
    "lastCheckedAt" DATETIME,
    "isUpdatable" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Dependency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Container" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "latestVersion" TEXT,
    "lastCheckedAt" DATETIME,
    "isUpdatable" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Container_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Dependency_projectId_name_key" ON "Dependency"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Container_projectId_image_tag_key" ON "Container"("projectId", "image", "tag");
