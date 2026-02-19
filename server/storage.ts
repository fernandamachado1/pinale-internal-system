import { db } from "./db";
import {
  materials,
  products,
  technicalSpecs,
  productions,
  sales,
  inventoryMovements,
  type Material,
  type InsertMaterial,
  type UpdateMaterialRequest,
  type Product,
  type InsertProduct,
  type UpdateProductRequest,
  type ProductWithSpecs,
  type Production,
  type InsertProduction,
  type ProductionWithProduct,
  type Sale,
  type InsertSale,
  type SaleWithProduct,
  type InventoryMovement,
  type MovementWithDetails
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Materials
  getMaterials(): Promise<Material[]>;
  getMaterial(id: number): Promise<Material | undefined>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: number, updates: UpdateMaterialRequest): Promise<Material>;
  adjustMaterialStock(id: number, quantityChange: number, reason: string): Promise<Material>;

  // Products
  getProducts(): Promise<ProductWithSpecs[]>;
  getProduct(id: number): Promise<ProductWithSpecs | undefined>;
  createProduct(product: InsertProduct, specs: { materialId: number, quantityRequired: string }[]): Promise<ProductWithSpecs>;
  updateProduct(id: number, product: UpdateProductRequest, specs?: { materialId: number, quantityRequired: string }[]): Promise<ProductWithSpecs>;
  
  // Productions
  getProductions(): Promise<ProductionWithProduct[]>;
  createProduction(production: InsertProduction): Promise<ProductionWithProduct>;

  // Sales
  getSales(): Promise<SaleWithProduct[]>;
  createSale(sale: InsertSale): Promise<SaleWithProduct>;

  // Inventory
  getInventoryMovements(): Promise<MovementWithDetails[]>;
}

export class DatabaseStorage implements IStorage {
  
  // Materials
  async getMaterials(): Promise<Material[]> {
    return await db.select().from(materials);
  }

  async getMaterial(id: number): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.id, id));
    return material;
  }

  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    const [material] = await db.insert(materials).values(insertMaterial).returning();
    return material;
  }

  async updateMaterial(id: number, updates: UpdateMaterialRequest): Promise<Material> {
    const [material] = await db.update(materials).set(updates).where(eq(materials.id, id)).returning();
    return material;
  }

  async adjustMaterialStock(id: number, quantityChange: number, reason: string): Promise<Material> {
    return await db.transaction(async (tx) => {
      const [material] = await tx.select().from(materials).where(eq(materials.id, id));
      if (!material) throw new Error("Material not found");

      const newQuantity = (parseFloat(material.quantity) + quantityChange).toFixed(2);
      
      const [updatedMaterial] = await tx.update(materials)
        .set({ quantity: newQuantity })
        .where(eq(materials.id, id))
        .returning();

      await tx.insert(inventoryMovements).values({
        type: quantityChange >= 0 ? 'material_in' : 'material_out',
        materialId: id,
        quantityChange: quantityChange.toFixed(2),
        reason: reason
      });

      return updatedMaterial;
    });
  }

  // Products
  async getProducts(): Promise<ProductWithSpecs[]> {
    const allProducts = await db.select().from(products);
    const allSpecs = await db.select().from(technicalSpecs);
    const allMaterials = await db.select().from(materials);

    return allProducts.map(p => {
      const specsForProduct = allSpecs.filter(s => s.productId === p.id);
      const specsWithMaterials = specsForProduct.map(s => ({
        ...s,
        material: allMaterials.find(m => m.id === s.materialId)!
      }));
      return { ...p, technicalSpecs: specsWithMaterials };
    });
  }

  async getProduct(id: number): Promise<ProductWithSpecs | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) return undefined;

    const specs = await db.select().from(technicalSpecs).where(eq(technicalSpecs.productId, id));
    const allMaterials = await db.select().from(materials);

    const specsWithMaterials = specs.map(s => ({
      ...s,
      material: allMaterials.find(m => m.id === s.materialId)!
    }));

    return { ...product, technicalSpecs: specsWithMaterials };
  }

  async createProduct(insertProduct: InsertProduct, specs: { materialId: number, quantityRequired: string }[]): Promise<ProductWithSpecs> {
    return await db.transaction(async (tx) => {
      const [product] = await tx.insert(products).values(insertProduct).returning();
      
      const insertedSpecs = [];
      for (const spec of specs) {
        const [insertedSpec] = await tx.insert(technicalSpecs).values({
          productId: product.id,
          materialId: spec.materialId,
          quantityRequired: spec.quantityRequired
        }).returning();
        insertedSpecs.push(insertedSpec);
      }

      // Fetch the material details to return the full ProductWithSpecs
      const allMaterials = await tx.select().from(materials);
      const specsWithMaterials = insertedSpecs.map(s => ({
        ...s,
        material: allMaterials.find(m => m.id === s.materialId)!
      }));

      return { ...product, technicalSpecs: specsWithMaterials };
    });
  }

  async updateProduct(id: number, updates: UpdateProductRequest, specs?: { materialId: number, quantityRequired: string }[]): Promise<ProductWithSpecs> {
    return await db.transaction(async (tx) => {
      const [product] = await tx.update(products).set(updates).where(eq(products.id, id)).returning();
      
      if (specs) {
        // Delete old specs
        await tx.delete(technicalSpecs).where(eq(technicalSpecs.productId, id));
        // Insert new specs
        for (const spec of specs) {
          await tx.insert(technicalSpecs).values({
            productId: product.id,
            materialId: spec.materialId,
            quantityRequired: spec.quantityRequired
          });
        }
      }

      // We need to return the updated object with its specs
      const finalSpecs = await tx.select().from(technicalSpecs).where(eq(technicalSpecs.productId, id));
      const allMaterials = await tx.select().from(materials);

      const specsWithMaterials = finalSpecs.map(s => ({
        ...s,
        material: allMaterials.find(m => m.id === s.materialId)!
      }));

      return { ...product, technicalSpecs: specsWithMaterials };
    });
  }

  // Productions
  async getProductions(): Promise<ProductionWithProduct[]> {
    const allProductions = await db.select().from(productions).orderBy(desc(productions.createdAt));
    const allProducts = await db.select().from(products);
    
    return allProductions.map(p => ({
      ...p,
      product: allProducts.find(prod => prod.id === p.productId)!
    }));
  }

  async createProduction(insertProduction: InsertProduction): Promise<ProductionWithProduct> {
    return await db.transaction(async (tx) => {
      // 1. Get product and specs
      const [product] = await tx.select().from(products).where(eq(products.id, insertProduction.productId));
      if (!product) throw new Error("Produto não encontrado");

      const specs = await tx.select().from(technicalSpecs).where(eq(technicalSpecs.productId, product.id));
      
      // 2. Check if enough materials exist
      for (const spec of specs) {
        const [material] = await tx.select().from(materials).where(eq(materials.id, spec.materialId));
        const requiredQty = parseFloat(spec.quantityRequired) * insertProduction.quantityProduced;
        if (parseFloat(material.quantity) < requiredQty) {
          throw new Error(`Insumo insuficiente: ${material.name}. Necessário: ${requiredQty}, Disponível: ${material.quantity}`);
        }
      }

      // 3. Deduct materials
      for (const spec of specs) {
        const [material] = await tx.select().from(materials).where(eq(materials.id, spec.materialId));
        const requiredQty = parseFloat(spec.quantityRequired) * insertProduction.quantityProduced;
        const newQty = (parseFloat(material.quantity) - requiredQty).toFixed(2);
        
        await tx.update(materials).set({ quantity: newQty }).where(eq(materials.id, spec.materialId));
        
        // Log movement
        await tx.insert(inventoryMovements).values({
          type: 'material_out',
          materialId: material.id,
          sourceId: insertProduction.productId, // storing product id as source for context
          quantityChange: (-requiredQty).toFixed(2),
          reason: 'Produção'
        });
      }

      // 4. Increase product quantity
      const newProductQty = product.quantity + insertProduction.quantityProduced;
      await tx.update(products).set({ quantity: newProductQty }).where(eq(products.id, product.id));

      // 5. Create production record
      const [production] = await tx.insert(productions).values({
        ...insertProduction,
        status: 'completed'
      }).returning();

      // Log product movement
      await tx.insert(inventoryMovements).values({
        type: 'product_in',
        productId: product.id,
        sourceId: production.id,
        quantityChange: insertProduction.quantityProduced.toString(),
        reason: 'Produção concluída'
      });

      return { ...production, product };
    });
  }

  // Sales
  async getSales(): Promise<SaleWithProduct[]> {
    const allSales = await db.select().from(sales).orderBy(desc(sales.createdAt));
    const allProducts = await db.select().from(products);
    
    return allSales.map(s => ({
      ...s,
      product: allProducts.find(prod => prod.id === s.productId)!
    }));
  }

  async createSale(insertSale: InsertSale): Promise<SaleWithProduct> {
    return await db.transaction(async (tx) => {
      // 1. Get product
      const [product] = await tx.select().from(products).where(eq(products.id, insertSale.productId));
      if (!product) throw new Error("Produto não encontrado");

      // 2. Check stock
      if (product.quantity < insertSale.quantitySold) {
        throw new Error(`Estoque insuficiente do produto: ${product.name}. Disponível: ${product.quantity}`);
      }

      // 3. Deduct product
      const newProductQty = product.quantity - insertSale.quantitySold;
      await tx.update(products).set({ quantity: newProductQty }).where(eq(products.id, product.id));

      // 4. Create sale record
      const [sale] = await tx.insert(sales).values(insertSale).returning();

      // 5. Log movement
      await tx.insert(inventoryMovements).values({
        type: 'product_out',
        productId: product.id,
        sourceId: sale.id,
        quantityChange: (-insertSale.quantitySold).toString(),
        reason: 'Venda realizada'
      });

      return { ...sale, product };
    });
  }

  // Inventory Movements
  async getInventoryMovements(): Promise<MovementWithDetails[]> {
    const allMovements = await db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt));
    const allProducts = await db.select().from(products);
    const allMaterials = await db.select().from(materials);

    return allMovements.map(m => ({
      ...m,
      product: m.productId ? allProducts.find(p => p.id === m.productId) : null,
      material: m.materialId ? allMaterials.find(mat => mat.id === m.materialId) : null
    }));
  }
}

export const storage = new DatabaseStorage();