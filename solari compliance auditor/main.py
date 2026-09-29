import asyncio
import json
import sys

from pipeline import audit_contract


async def main():
    if len(sys.argv) != 3:
        print("Usage: python main.py <pdf_path> <contract_id>")
        sys.exit(1)

    pdf_path, contract_id = sys.argv[1], sys.argv[2]
    results = await audit_contract(pdf_path, contract_id)

    for r in results:
        print(f"{r['clause']['id']}: {r['status']} (review: {r['review_status']})")

    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
