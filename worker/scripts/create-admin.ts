import { hashPassword } from "../src/lib/password";

const args = process.argv.slice(2);
const getArg = (name: string) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const username = getArg("username");
const password = getArg("password");
const role = getArg("role") ?? "super_admin";
const organizationIdRaw = getArg("organizationId");

const usage =
  "Usage: npx tsx scripts/create-admin.ts --username <name> --password <pw> [--role super_admin|org_admin] [--organizationId <id>]";

if (!username || !password) {
  console.error(usage);
  process.exit(1);
}

if (role !== "super_admin" && role !== "org_admin") {
  console.error("--role must be super_admin or org_admin");
  process.exit(1);
}

if (role === "org_admin" && !organizationIdRaw) {
  console.error("--organizationId is required when --role org_admin");
  process.exit(1);
}

const main = async () => {
  const hash = await hashPassword(password);
  const escapedHash = hash.replace(/'/g, "''");
  const organizationIdValue = organizationIdRaw
    ? Number(organizationIdRaw)
    : "NULL";

  console.log(
    `INSERT INTO admins (username, password_hash, role, organization_id) VALUES ('${username}', '${escapedHash}', '${role}', ${organizationIdValue});`,
  );
};

main();
