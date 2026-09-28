process.env.DATABASE_URL = "file:/home/noor/programs/dependency-manager/prisma/dev.db";
import { PrismaClient } from "@prisma/client";
import { checkUpdates } from "./src/lib/actions";
const p = new PrismaClient();
(async () => {
  const stray = await p.container.findFirst({ where: { projectId: 6, image: "ghcr.io/flaresolverr/flaresolverr" } });
  if (stray) { await p.container.delete({ where: { id: stray.id } }); console.log("removed stray:", stray.image + ":" + stray.tag); }
  else { console.log("no stray found"); }
  const all = await p.container.findMany({ where: { projectId: 6 }, select: { image: true, tag: true } });
  console.log("\nProject 6 containers:");
  for (const c of all) console.log("  " + c.image + ":" + c.tag);
  console.log("\ncheckUpdates ->", JSON.stringify(await checkUpdates(6)));
  await p.$disconnect();
})();
