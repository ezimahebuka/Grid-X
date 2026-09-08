# Grid X — Backend

Express + TypeScript + MongoDB (via Prisma) + Redis/BullMQ.

## Getting started

1. Copy the env file and fill in what you have so far (Auth only needs `JWT_SECRET` and `DATABASE_URL` to run):

   ```bash
   cp .env.example .env
   ```

2. Start Mongo (as a replica set) and Redis with Docker:

   ```bash
   docker compose up -d mongo redis
   ```

   Give it ~10-15 seconds on first boot — the healthcheck is what initializes the replica set automatically. You can confirm it worked with:

   ```bash
   docker exec -it bill-unity-mongo mongosh --eval "rs.status()"
   ```

3. Install dependencies and generate the Prisma client:

   ```bash
   npm install
   npm run prisma:generate
   npm run prisma:push
   ```

   Configure these VTPass values in `.env` before starting the server:

   ```env
   VTPASS_API_KEY=your-vtpass-api-key
   VTPASS_SECRET_KEY=your-vtpass-secret-key
   VTPASS_BASE_URL=https://vtpass.com/api
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

5. Test it:

   ```bash
   curl http://localhost:4000/api/v1/health

   curl -X POST http://localhost:4000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"phone": "08012345678", "password": "password123"}'

   curl -X POST http://localhost:4000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"phone": "08012345678", "password": "password123"}'

    # Copy the token from the login response, then send it with identity verification:

    curl -X POST http://localhost:4000/api/v1/identity/verify \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"type":"NIN","id":"K0111111111111L","verification_consent":true}'

    # Initialize a Korapay wallet top-up. The server returns checkout_url;
    # open that URL in the client so Korapay collects card or bank details.
    curl -X POST http://localhost:9000/api/v1/wallet/topups/initialize \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"amount":120000,"redirect_url":"https://your-frontend.example.com/wallet"}'

      # Read the current wallet balance.
      curl http://localhost:9000/api/v1/wallet \
         -H "Authorization: Bearer YOUR_LOGIN_TOKEN"

    # Check the top-up status after checkout or webhook processing.
    curl http://localhost:9000/api/v1/wallet/topups/KPY-WALLET-REFERENCE \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN"

    # Verify the payment after the customer returns from Korapay checkout.
    # This is also a recovery path if the webhook is delayed.
    curl -X POST http://localhost:9000/api/v1/wallet/topups/KPY-WALLET-REFERENCE/verify \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN"

      # Direct card top-up. This requires PCI DSS compliance and
      # KORAPAY_ENCRYPTION_KEY. Never log or store card fields.
      curl -X POST http://localhost:9000/api/v1/wallet/topups/card \
          -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
          -H "Content-Type: application/json" \
          -d '{
             "amount": 120000,
             "redirect_url": "https://your-frontend.example.com/wallet",
             "card": {
                "name": "Test Cards",
                "number": "5130000052131820",
                "cvv": "419",
                "expiry_month": "12",
                "expiry_year": "32",
                "pin": "0000"
             }
          }'

    # Korapay webhook URL (must be public HTTPS, not localhost):
    # POST https://YOUR_PUBLIC_DOMAIN/api/v1/wallet/webhook/korapay

    # Bill payments require an authenticated user with sufficient wallet balance.
    # Wallets are created automatically. Amounts are in naira.
    curl -X POST http://localhost:4000/api/v1/bills/airtime \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"serviceID":"mtn","amount":100,"phone":"08012345678"}'

    curl -X POST http://localhost:4000/api/v1/bills/data \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"serviceID":"mtn-data","billersCode":"08012345678","variation_code":"mtn-10mb-100","amount":100,"phone":"08012345678"}'

    curl -X POST http://localhost:4000/api/v1/bills/tv \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"serviceID":"dstv","billersCode":"SMARTCARD_NUMBER","variation_code":"dstv-padi","amount":2500,"phone":"08012345678"}'

    curl -X POST http://localhost:4000/api/v1/bills/electricity \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"serviceID":"ikeja-electric","billersCode":"METER_NUMBER","variation_code":"prepaid","amount":5000,"phone":"08012345678"}'

    curl -X POST http://localhost:4000/api/v1/bills/education \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"serviceID":"waec","amount":3500,"phone":"08012345678"}'

    curl -X POST http://localhost:4000/api/v1/bills/insurance \
       -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"serviceID":"ui-insure","amount":5000,"phone":"08012345678"}'

    # Configure this URL in VTPass for pending transaction callbacks:
    # POST /api/v1/bills/webhook/vtpass

    # Password recovery
    curl -X POST http://localhost:4000/api/v1/auth/forgot-password \
       -H "Content-Type: application/json" \
       -d '{"email":"you@example.com"}'

    curl -X POST http://localhost:4000/api/v1/auth/verify-reset-code \
       -H "Content-Type: application/json" \
       -d '{"email":"you@example.com","code":"123456"}'

    curl -X POST http://localhost:4000/api/v1/auth/reset-password \
       -H "Content-Type: application/json" \
       -d '{"email":"you@example.com","code":"123456","newPassword":"newpassword123","confirmPassword":"newpassword123"}'
   ```

## Adding a new module

Every module (`meters`, `wallet`, `vending`, `alerts`, `reconciliation`, `admin`) follows the same four-file pattern as `src/modules/auth/`:

```
<module>.schema.ts      → zod validation schemas
<module>.service.ts     → business logic, talks to Prisma and other modules' services
<module>.controller.ts  → thin layer: parses req, calls service, sends response
<module>.routes.ts      → Express Router, wires paths + middleware to controller functions
```

Then mount the new router in `src/routes/index.ts`.

**Rule to keep this codebase senior-grade as it grows**: a module's service is the _only_ thing allowed to import Prisma or call another module's service. Controllers never touch Prisma directly, and one module's controller never imports another module's service.

## Why the Mongo replica set matters

Prisma's `$transaction()` (needed anywhere a write must be atomic — e.g. debiting a wallet and creating a vending transaction together) requires MongoDB to run as a replica set, even a single-node one. The `docker-compose.yml` healthcheck handles this automatically; if you ever run Mongo outside Docker, remember to start it with `--replSet rs0` and run `rs.initiate()` once.
