import { db } from "./connection.js";

const developers = [
  { name: "Priyansh", role: "Senior Dev" },
  { name: "Ashif", role: "Senior Dev" },
  { name: "Akash", role: "Dev" },
  { name: "Vignesh", role: "Dev" },
  { name: "Rahul", role: "Junior Dev" },
  { name: "Aaditya", role: "Junior Dev" },
  { name: "Ashu", role: "Senior Dev" },
];

const existing = db.prepare("SELECT COUNT(*) AS n FROM developers").get() as { n: number };

if (existing.n > 0) {
  console.log(`Skipping seed — developers table already has ${existing.n} row(s).`);
} else {
  const insert = db.prepare("INSERT INTO developers (name, role) VALUES (@name, @role)");
  const insertMany = db.transaction((rows: typeof developers) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(developers);
  console.log(`Seeded ${developers.length} developers.`);
}
