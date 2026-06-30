import clientPromise from "../lib/mongo"

async function main() {
  const client = await clientPromise
  const db = client.db("mena_partner")

  await db.collection("contracts").createIndex(
    { contractCode: 1 },
    { unique: true, name: "contractCode_unique" }
  )

  await db.collection("drivers").createIndex(
    { contractCode: 1 },
    { unique: true, name: "contractCode_unique" }
  )

  await db.collection("payroll_entries").createIndex(
    { month: 1, contractCode: 1 },
    { unique: true, name: "month_contractCode_unique" }
  )

  console.log("Indexes created successfully")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
