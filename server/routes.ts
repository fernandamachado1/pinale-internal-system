import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- MATERIALS ---
  app.get(api.materials.list.path, async (req, res) => {
    const materials = await storage.getMaterials();
    res.json(materials);
  });

  app.get(api.materials.get.path, async (req, res) => {
    const material = await storage.getMaterial(Number(req.params.id));
    if (!material) return res.status(404).json({ message: "Material not found" });
    res.json(material);
  });

  app.post(api.materials.create.path, async (req, res) => {
    try {
      const input = api.materials.create.input.parse(req.body);
      const material = await storage.createMaterial(input);
      res.status(201).json(material);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.materials.update.path, async (req, res) => {
    try {
      const input = api.materials.update.input.parse(req.body);
      const material = await storage.updateMaterial(Number(req.params.id), input);
      res.json(material);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.materials.adjustStock.path, async (req, res) => {
    try {
      const input = api.materials.adjustStock.input.parse(req.body);
      const material = await storage.adjustMaterialStock(Number(req.params.id), parseFloat(input.quantityChange), input.reason);
      res.json(material);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- PRODUCTS ---
  app.get(api.products.list.path, async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get(api.products.get.path, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.post(api.products.create.path, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct(input.product, input.specs || []);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put(api.products.update.path, async (req, res) => {
    try {
      const input = api.products.update.input.parse(req.body);
      const product = await storage.updateProduct(Number(req.params.id), input.product, input.specs);
      res.json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- PRODUCTIONS ---
  app.get(api.productions.list.path, async (req, res) => {
    const productions = await storage.getProductions();
    res.json(productions);
  });

  app.post(api.productions.create.path, async (req, res) => {
    try {
      const input = api.productions.create.input.parse(req.body);
      const production = await storage.createProduction(input);
      res.status(201).json(production);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- SALES ---
  app.get(api.sales.list.path, async (req, res) => {
    const sales = await storage.getSales();
    res.json(sales);
  });

  app.post(api.sales.create.path, async (req, res) => {
    try {
      const input = api.sales.create.input.parse(req.body);
      const sale = await storage.createSale(input);
      res.status(201).json(sale);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- INVENTORY MOVEMENTS ---
  app.get(api.inventory.movements.path, async (req, res) => {
    const movements = await storage.getInventoryMovements();
    res.json(movements);
  });

  // SEED DATA
  async function seedDatabase() {
    const materials = await storage.getMaterials();
    if (materials.length === 0) {
      console.log('Seeding initial materials and products...');
      const mat1 = await storage.createMaterial({ name: "Tecido Algodão", unit: "m", quantity: "50.00" });
      const mat2 = await storage.createMaterial({ name: "Linha Costura", unit: "un", quantity: "10.00" });
      const mat3 = await storage.createMaterial({ name: "Zíper 20cm", unit: "un", quantity: "30.00" });
      const mat4 = await storage.createMaterial({ name: "Etiqueta Pinale", unit: "un", quantity: "100.00" });
      
      const prod1 = await storage.createProduct(
        { name: "Bolsa Pitanga", price: "120.00", quantity: 5 },
        [
          { materialId: mat1.id, quantityRequired: "0.50" },
          { materialId: mat2.id, quantityRequired: "0.10" },
          { materialId: mat3.id, quantityRequired: "1.00" },
          { materialId: mat4.id, quantityRequired: "1.00" }
        ]
      );
      
      const prod2 = await storage.createProduct(
        { name: "Necessaire Folha", price: "45.00", quantity: 12 },
        [
          { materialId: mat1.id, quantityRequired: "0.20" },
          { materialId: mat2.id, quantityRequired: "0.05" },
          { materialId: mat3.id, quantityRequired: "1.00" },
          { materialId: mat4.id, quantityRequired: "1.00" }
        ]
      );
    }
  }
  
  // Call seed asynchronously 
  seedDatabase().catch(console.error);

  return httpServer;
}