# Route Map

- `/login` → `client/src/pages/Login.tsx` (standalone form; not wrapped by `Layout` in App. Uses card-based login view.)
- `/` → `client/src/pages/Dashboard.tsx` (wrapped by `Layout` with sidebar + header.)
- `/materials/new` → `client/src/pages/MaterialFormPage.tsx` (Layout wrapper; used to create materials.)
- `/materials/:id/edit` → `client/src/pages/MaterialFormPage.tsx` (Layout wrapper; editing materials.)
- `/materials` → `client/src/pages/Materials.tsx` (Layout wrapper; list of stocked materials.)
- `/products` → `client/src/pages/Products.tsx` (Layout wrapper.)
- `/produced-stock` → `client/src/pages/ProducedStock.tsx` (Layout wrapper.)
- `/production` → `client/src/pages/Production.tsx` (Layout wrapper; drag-and-drop board.)
- `/purchase-orders` → `client/src/pages/PurchaseOrders.tsx` (Layout wrapper; PO list.)
- `/sales` → `client/src/pages/Sales.tsx` (Layout wrapper; sales list and produced stock.)
- `/movements` → `client/src/pages/Movements.tsx` (Layout wrapper; ledger details.)
- `*` (catch-all) → `client/src/pages/not-found.tsx` (Layout wrapper for 404.)
