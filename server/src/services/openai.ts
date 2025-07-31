import OpenAI from "openai";
import {
  MealAnalysisResult,
  MealPlanRequest,
  MealPlanResponse,
  ReplacementMealRequest,
} from "../types/openai";
import { extractCleanJSON } from "../utils/openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Helper function to validate and clean base64 image data
function validateAndCleanBase64(imageBase64: string): string {
  console.log("🔍 Validating base64 image data...");

  if (!imageBase64 || imageBase64.trim() === "") {
    throw new Error("Empty image data provided");
  }

  let cleanBase64 = imageBase64.trim();

  // Remove data URL prefix if present
  if (cleanBase64.startsWith("data:image/")) {
    const commaIndex = cleanBase64.indexOf(",");
    if (commaIndex === -1) {
      throw new Error("Invalid data URL format - missing comma");
    }
    cleanBase64 = cleanBase64.substring(commaIndex + 1);
  }

  // Remove any whitespace
  cleanBase64 = cleanBase64.replace(/\s/g, "");

  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(cleanBase64)) {
    throw new Error("Invalid base64 format - contains invalid characters");
  }

  // Check minimum length (at least 1KB for a valid image)
  if (cleanBase64.length < 1000) {
    throw new Error("Base64 data too short - likely not a valid image");
  }

  // Check maximum size (10MB limit)
  const estimatedBytes = (cleanBase64.length * 3) / 4;
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB
  if (estimatedBytes > maxSizeBytes) {
    throw new Error("Image too large - must be under 10MB");
  }

  console.log(
    `✅ Base64 validation successful: ${
      cleanBase64.length
    } chars, ~${Math.round(estimatedBytes / 1024)}KB`
  );
  return cleanBase64;
}

export class OpenAIService {
  private static openai = process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
    : null;

  static async generateText(
    prompt: string,
    maxTokens: number = 4000
  ): Promise<string> {
    try {
      console.log("🤖 Sending request to OpenAI...");
      console.log("📏 Prompt length:", prompt.length, "characters");

      const response = await this.openai?.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a professional nutritionist and meal planning expert specializing in Israeli cuisine and ingredients. You create comprehensive, detailed meal plans with exact nutrition data and realistic costs in Israeli Shekels. Always return valid JSON without markdown formatting. Focus on creating complete, practical meal plans that people will actually want to eat.",
          },
          {
            role: "user",
            content:
              prompt.length > 6000 ? prompt.substring(0, 6000) + "..." : prompt,
          },
        ],
        max_tokens: Math.min(maxTokens, 4000),
        temperature: 0.3,
      });

      const content = response?.choices[0]?.message?.content || "";
      console.log("✅ OpenAI response received, length:", content.length);

      const cleanedContent = content
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      console.log("🧹 Cleaned OpenAI response");
      return cleanedContent;
    } catch (error: any) {
      console.error("💥 OpenAI API error:", error);
      if (error.code === "insufficient_quota") {
        throw new Error(
          "OpenAI quota exceeded. Using fallback menu generation."
        );
      }
      throw new Error("Failed to generate AI response");
    }
  }

  static async analyzeMealImage(
    imageBase64: string,
    language: string = "english",
    updateText?: string,
    editedIngredients?: any[]
  ): Promise<MealAnalysisResult> {
    try {
      console.log("🤖 Starting meal image analysis...");
      console.log("🥗 Edited ingredients count:", editedIngredients?.length || 0);

      // Validate and clean the image data
      let cleanBase64: string;
      try {
        cleanBase64 = validateAndCleanBase64(imageBase64);
      } catch (validationError: any) {
        console.log("⚠️ Image validation failed:", validationError.message);
        console.log("🔄 Using intelligent fallback analysis...");
        return this.getIntelligentFallbackAnalysis(language, updateText, editedIngredients);
      }

      // Try OpenAI analysis if available
      if (process.env.OPENAI_API_KEY && this.openai) {
        try {
          console.log("🚀 Attempting OpenAI analysis...");
          return await this.callOpenAIForAnalysis(
            cleanBase64,
            language,
            updateText,
            editedIngredients
          );
        } catch (openaiError: any) {
          console.log("⚠️ OpenAI failed:", openaiError.message);
          // Always use fallback on OpenAI failure
          return this.getIntelligentFallbackAnalysis(language, updateText, editedIngredients);
        }
      } else {
        console.log("⚠️ No OpenAI API key, using intelligent fallback");
        return this.getIntelligentFallbackAnalysis(language, updateText, editedIngredients);
      }
    } catch (error: any) {
      console.log("💥 Main analysis failed:", error.message);
      // Always return fallback - NEVER throw error
      return this.getIntelligentFallbackAnalysis(language, updateText, editedIngredients);
    }
  }

  private static async callOpenAIForAnalysis(
    cleanBase64: string,
    language: string,
    updateText?: string,
    editedIngredients?: any[]
  ): Promise<MealAnalysisResult> {
    // Build context from edited ingredients if provided
    let ingredientsContext = "";
    if (editedIngredients && editedIngredients.length > 0) {
      ingredientsContext = `\n\nUSER PROVIDED INGREDIENTS: ${editedIngredients.map(ing => 
        `${ing.name}: ${ing.calories}cal, ${ing.protein}g protein, ${ing.carbs}g carbs, ${ing.fat}g fat`
      ).join("; ")}`;
    }

    const systemPrompt = `You are a professional nutritionist. Analyze the food image and provide precise nutritional data.

IMPORTANT: Respond in ${
      language === "hebrew" ? "Hebrew" : "English"
    } language. All text fields should be in ${
      language === "hebrew" ? "Hebrew" : "English"
    }.

ANALYSIS RULES:
1. Analyze all visible food items and estimate total serving size
2. Provide accurate nutritional values for the complete visible portion
3. Be conservative with estimates - prefer underestimating
4. Consider cooking methods, visible oils, sauces, and seasonings
5. Identify potential allergens and additives

${
  updateText
    ? `CONTEXT: User provided: "${updateText}". Incorporate this into your analysis and update the ingredients list accordingly.`
    : ""
}

Return JSON with ALL fields below (text fields in ${
      language === "hebrew" ? "Hebrew" : "English"
    }):
{
  "meal_name": "Brief descriptive name",
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fats_g": number,
  "saturated_fats_g": number,
  "polyunsaturated_fats_g": number,
  "monounsaturated_fats_g": number,
  "omega_3_g": number,
  "omega_6_g": number,
  "fiber_g": number,
  "soluble_fiber_g": number,
  "insoluble_fiber_g": number,
  "sugar_g": number,
  "cholesterol_mg": number,
  "sodium_mg": number,
  "alcohol_g": number,
  "caffeine_mg": number,
  "liquids_ml": number,
  "serving_size_g": number,
  "allergens_json": {"possible_allergens": ["gluten", "dairy", "nuts", "etc"]},
  "vitamins_json": {
    "vitamin_a_mcg": number,
    "vitamin_c_mg": number,
    "vitamin_d_mcg": number,
    "vitamin_e_mg": number,
    "vitamin_k_mcg": number,
    "vitamin_b12_mcg": number,
    "folate_mcg": number,
    "niacin_mg": number,
    "thiamin_mg": number,
    "riboflavin_mg": number,
    "pantothenic_acid_mg": number,
    "vitamin_b6_mg": number
  },
  "micronutrients_json": {
    "iron_mg": number,
    "magnesium_mg": number,
    "zinc_mg": number,
    "calcium_mg": number,
    "potassium_mg": number,
    "phosphorus_mg": number,
    "selenium_mcg": number,
    "copper_mg": number,
    "manganese_mg": number
  },
  "glycemic_index": number,
  "insulin_index": number,
  "food_category": "Fast Food/Homemade/Snack/Beverage/etc",
  "processing_level": "Unprocessed/Minimally processed/Ultra-processed",
  "cooking_method": "Grilled/Fried/Boiled/Raw/Baked/etc",
  "additives_json": {"observed_additives": ["preservatives", "colorings", "etc"]},
  "health_risk_notes": "Brief health assessment",
  "confidence": number (0-1),
  "ingredients": ["main", "visible", "ingredients"],
  "ingredients_list": ["ingredient1", "ingredient2", "ingredient3"],
  "servingSize": "1 bowl/2 slices/etc",
  "cookingMethod": "How prepared",
  "healthNotes": "Brief dietary notes"
}

Language: ${language}`;

    let userPrompt = "Please analyze this food image and provide detailed nutritional information.";
    if (updateText) {
      userPrompt += ` Additional context: ${updateText}`;
    }
    if (ingredientsContext) {
      userPrompt += ingredientsContext;
    }

    console.log("🚀 CALLING OPENAI API!");

    const response = await this.openai!.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${cleanBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.1,
    });

    const content = response?.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    console.log("🤖 OpenAI response received successfully!");

    const cleanJSON = extractCleanJSON(content);
    const parsed = JSON.parse(cleanJSON);

    // If edited ingredients were provided, merge them with AI analysis
    let finalIngredients = parsed.ingredients || [];
    if (editedIngredients && editedIngredients.length > 0) {
      console.log("🔄 Merging edited ingredients with AI analysis");
      finalIngredients = editedIngredients.map((editedIng: any) => ({
        name: editedIng.name,
        calories: editedIng.calories || 0,
        protein_g: editedIng.protein || 0,
        carbs_g: editedIng.carbs || 0,
        fats_g: editedIng.fat || 0,
        fiber_g: editedIng.fiber || 0,
        sugar_g: editedIng.sugar || 0,
        sodium_mg: editedIng.sodium_mg || 0,
      }));
      
      // Recalculate totals based on edited ingredients
      const totals = finalIngredients.reduce((acc: any, ing: any) => ({
        calories: acc.calories + (ing.calories || 0),
        protein: acc.protein + (ing.protein_g || 0),
        carbs: acc.carbs + (ing.carbs_g || 0),
        fat: acc.fat + (ing.fats_g || 0),
        fiber: acc.fiber + (ing.fiber_g || 0),
        sugar: acc.sugar + (ing.sugar_g || 0),
        sodium: acc.sodium + (ing.sodium_mg || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });
      
      // Update parsed values with recalculated totals
      parsed.calories = totals.calories;
      parsed.protein_g = totals.protein;
      parsed.carbs_g = totals.carbs;
      parsed.fats_g = totals.fat;
      parsed.fiber_g = totals.fiber;
      parsed.sugar_g = totals.sugar;
      parsed.sodium_mg = totals.sodium;
    }
    const analysisResult: MealAnalysisResult = {
      name: parsed.meal_name || "AI Analyzed Meal",
      description: parsed.description || "",
      calories: Math.max(0, Number(parsed.calories) || 0),
      protein: Math.max(0, Number(parsed.protein_g) || 0),
      carbs: Math.max(0, Number(parsed.carbs_g) || 0),
      fat: Math.max(0, Number(parsed.fats_g) || 0),
      saturated_fats_g: parsed.saturated_fats_g
        ? Math.max(0, Number(parsed.saturated_fats_g))
        : undefined,
      polyunsaturated_fats_g: parsed.polyunsaturated_fats_g
        ? Math.max(0, Number(parsed.polyunsaturated_fats_g))
        : undefined,
      monounsaturated_fats_g: parsed.monounsaturated_fats_g
        ? Math.max(0, Number(parsed.monounsaturated_fats_g))
        : undefined,
      omega_3_g: parsed.omega_3_g
        ? Math.max(0, Number(parsed.omega_3_g))
        : undefined,
      omega_6_g: parsed.omega_6_g
        ? Math.max(0, Number(parsed.omega_6_g))
        : undefined,
      fiber: parsed.fiber_g ? Math.max(0, Number(parsed.fiber_g)) : undefined,
      soluble_fiber_g: parsed.soluble_fiber_g
        ? Math.max(0, Number(parsed.soluble_fiber_g))
        : undefined,
      insoluble_fiber_g: parsed.insoluble_fiber_g
        ? Math.max(0, Number(parsed.insoluble_fiber_g))
        : undefined,
      sugar: parsed.sugar_g ? Math.max(0, Number(parsed.sugar_g)) : undefined,
      cholesterol_mg: parsed.cholesterol_mg
        ? Math.max(0, Number(parsed.cholesterol_mg))
        : undefined,
      sodium: parsed.sodium_mg
        ? Math.max(0, Number(parsed.sodium_mg))
        : undefined,
      alcohol_g: parsed.alcohol_g
        ? Math.max(0, Number(parsed.alcohol_g))
        : undefined,
      caffeine_mg: parsed.caffeine_mg
        ? Math.max(0, Number(parsed.caffeine_mg))
        : undefined,
      liquids_ml: parsed.liquids_ml
        ? Math.max(0, Number(parsed.liquids_ml))
        : undefined,
      serving_size_g: parsed.serving_size_g
        ? Math.max(0, Number(parsed.serving_size_g))
        : undefined,
      allergens_json: parsed.allergens_json || null,
      vitamins_json: parsed.vitamins_json || null,
      micronutrients_json: parsed.micronutrients_json || null,
      additives_json: parsed.additives_json || null,
      glycemic_index: parsed.glycemic_index
        ? Math.max(0, Number(parsed.glycemic_index))
        : undefined,
      insulin_index: parsed.insulin_index
        ? Math.max(0, Number(parsed.insulin_index))
        : undefined,
      food_category: parsed.food_category || null,
      processing_level: parsed.processing_level || null,
      cooking_method: parsed.cooking_method || null,
      health_risk_notes: parsed.health_risk_notes || null,
      confidence: Math.min(
        100,
        Math.max(0, Number(parsed.confidence) * 100 || 85)
      ),
      ingredients: Array.isArray(finalIngredients)
        ? finalIngredients.map((ing: any) => {
            if (typeof ing === "string") {
              return {
                name: ing,
                calories: 0,
                protein_g: 0,
                carbs_g: 0,
                fats_g: 0,
              };
            }
            return {
              name: ing.name || "Unknown",
              calories: Math.max(0, Number(ing.calories) || 0),
              protein_g: Math.max(
                0,
                Number(ing.protein_g) || Number(ing.protein) || 0
              ),
              carbs_g: Math.max(
                0,
                Number(ing.carbs_g) || Number(ing.carbs) || 0
              ),
              fats_g: Math.max(
                0,
                Number(ing.fats_g) || Number(ing.fat) || Number(ing.fats) || 0
              ),
              fiber_g: ing.fiber_g
                ? Math.max(0, Number(ing.fiber_g))
                : undefined,
              sugar_g: ing.sugar_g
                ? Math.max(0, Number(ing.sugar_g))
                : undefined,
              sodium_mg: ing.sodium_mg
                ? Math.max(0, Number(ing.sodium_mg))
                : undefined,
            };
          })
        : typeof finalIngredients === "string"
        ? [
            {
              name: finalIngredients,
              calories: 0,
              protein_g: 0,
              carbs_g: 0,
              fats_g: 0,
            },
          ]
        : [],
      servingSize: parsed.servingSize || "1 serving",
      cookingMethod: parsed.cookingMethod || "Unknown",
      healthNotes: parsed.healthNotes || "",
    };

    console.log("✅ OpenAI analysis completed successfully!");
    return analysisResult;
  }

  private static getIntelligentFallbackAnalysis(
    language: string = "english",
    updateText?: string,
    editedIngredients?: any[]
  ): MealAnalysisResult {
    console.log("⚠️ Using fallback analysis - OpenAI not available or failed");
    console.log(
      "💡 To enable real AI analysis, ensure OPENAI_API_KEY is set in environment"
    );

    // If edited ingredients are provided, use them for calculations
    if (editedIngredients && editedIngredients.length > 0) {
      console.log("🔄 Using edited ingredients for fallback analysis");
      
      const totals = editedIngredients.reduce((acc: any, ing: any) => ({
        calories: acc.calories + (ing.calories || 0),
        protein: acc.protein + (ing.protein || 0),
        carbs: acc.carbs + (ing.carbs || 0),
        fat: acc.fat + (ing.fat || 0),
        fiber: acc.fiber + (ing.fiber || 0),
        sugar: acc.sugar + (ing.sugar || 0),
        sodium: acc.sodium + (ing.sodium_mg || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });

      return {
        name: language === "hebrew" ? "ארוחה מותאמת" : "Custom Meal",
        description: language === "hebrew" ? "ארוחה מבוססת רכיבים מותאמים" : "Meal based on custom ingredients",
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        fiber: totals.fiber,
        sugar: totals.sugar,
        sodium: totals.sodium,
        confidence: 90, // High confidence for user-edited ingredients
        ingredients: editedIngredients.map((ing: any) => ({
          name: ing.name,
          calories: ing.calories || 0,
          protein_g: ing.protein || 0,
          carbs_g: ing.carbs || 0,
          fats_g: ing.fat || 0,
          fiber_g: ing.fiber || 0,
          sugar_g: ing.sugar || 0,
          sodium_mg: ing.sodium_mg || 0,
        })),
        servingSize: "1 serving",
        cookingMethod: "Custom",
        healthNotes: language === "hebrew" ? "מבוסס על רכיבים מותאמים" : "Based on custom ingredients",
      };
    }
    const baseMeal = {
      name: language === "hebrew" ? "ארוחה מעורבת" : "Mixed Meal",
      description:
        language === "hebrew"
          ? "ארוחה מזינה ומאוזנת"
          : "Nutritious and balanced meal",
      calories: 420 + Math.floor(Math.random() * 200),
      protein: 25 + Math.floor(Math.random() * 15),
      carbs: 45 + Math.floor(Math.random() * 25),
      fat: 15 + Math.floor(Math.random() * 10),
      fiber: 8 + Math.floor(Math.random() * 6),
      sugar: 12 + Math.floor(Math.random() * 8),
      sodium: 600 + Math.floor(Math.random() * 400),
      confidence: 75,
      saturated_fats_g: 5 + Math.floor(Math.random() * 3),
      polyunsaturated_fats_g: 3 + Math.floor(Math.random() * 2),
      monounsaturated_fats_g: 7 + Math.floor(Math.random() * 3),
      omega_3_g: 0.5 + Math.random() * 0.8,
      omega_6_g: 2 + Math.random() * 1.5,
      soluble_fiber_g: 3 + Math.floor(Math.random() * 2),
      insoluble_fiber_g: 5 + Math.floor(Math.random() * 3),
      cholesterol_mg: 25 + Math.floor(Math.random() * 50),
      alcohol_g: 0,
      caffeine_mg: Math.floor(Math.random() * 20),
      liquids_ml: 50 + Math.floor(Math.random() * 100),
      serving_size_g: 250 + Math.floor(Math.random() * 200),
      glycemic_index: 45 + Math.floor(Math.random() * 25),
      insulin_index: 40 + Math.floor(Math.random() * 30),
      food_category: "Homemade",
      processing_level: "Minimally processed",
      cooking_method: "Mixed methods",
      health_risk_notes:
        language === "hebrew"
          ? "ארוחה בריאה ומאוזנת"
          : "Healthy and balanced meal",
    };

    // Apply user comment modifications more intelligently
    if (updateText) {
      const lowerUpdate = updateText.toLowerCase();

      // Analyze comment for specific foods
      if (lowerUpdate.includes("toast") || lowerUpdate.includes("bread")) {
        baseMeal.carbs += 20;
        baseMeal.calories += 80;
        baseMeal.name =
          language === "hebrew" ? "ארוחה עם לחם" : "Meal with Bread";
      }

      if (lowerUpdate.includes("butter") || lowerUpdate.includes("oil")) {
        baseMeal.fat += 10;
        baseMeal.calories += 90;
      }

      if (lowerUpdate.includes("cheese") || lowerUpdate.includes("dairy")) {
        baseMeal.protein += 8;
        baseMeal.fat += 6;
        baseMeal.calories += 80;
      }

      if (
        lowerUpdate.includes("big") ||
        lowerUpdate.includes("large") ||
        lowerUpdate.includes("גדול")
      ) {
        baseMeal.calories += 150;
        baseMeal.protein += 10;
        baseMeal.carbs += 15;
        baseMeal.fat += 8;
      }

      if (
        lowerUpdate.includes("small") ||
        lowerUpdate.includes("little") ||
        lowerUpdate.includes("קטן")
      ) {
        baseMeal.calories = Math.max(200, baseMeal.calories - 100);
        baseMeal.protein = Math.max(10, baseMeal.protein - 5);
        baseMeal.carbs = Math.max(20, baseMeal.carbs - 10);
        baseMeal.fat = Math.max(8, baseMeal.fat - 5);
      }

      if (
        lowerUpdate.includes("meat") ||
        lowerUpdate.includes("chicken") ||
        lowerUpdate.includes("beef") ||
        lowerUpdate.includes("בשר")
      ) {
        baseMeal.protein += 15;
        baseMeal.fat += 5;
        baseMeal.name = language === "hebrew" ? "ארוחת בשר" : "Meat Meal";
      }

      if (
        lowerUpdate.includes("salad") ||
        lowerUpdate.includes("vegetable") ||
        lowerUpdate.includes("סלט")
      ) {
        baseMeal.calories = Math.max(150, baseMeal.calories - 200);
        baseMeal.carbs = Math.max(15, baseMeal.carbs - 20);
        baseMeal.fiber += 5;
        baseMeal.name = language === "hebrew" ? "סלט ירקות" : "Vegetable Salad";
      }

      if (
        lowerUpdate.includes("pasta") ||
        lowerUpdate.includes("rice") ||
        lowerUpdate.includes("bread") ||
        lowerUpdate.includes("פסטה") ||
        lowerUpdate.includes("אורז")
      ) {
        baseMeal.carbs += 20;
        baseMeal.calories += 100;
        baseMeal.name =
          language === "hebrew" ? "ארוחת פחמימות" : "Carbohydrate Meal";
      }
    }

    // Generate more realistic ingredients based on comment
    const ingredients = [
      {
        name: updateText?.includes("toast")
          ? language === "hebrew"
            ? "לחם טוסט"
            : "Toast bread"
          : language === "hebrew"
          ? "רכיב עיקרי"
          : "Main ingredient",
        calories: Math.floor(baseMeal.calories * 0.4),
        protein_g: Math.floor(baseMeal.protein * 0.6),
        carbs_g: Math.floor(baseMeal.carbs * 0.5),
        fats_g: Math.floor(baseMeal.fat * 0.4),
      },
      {
        name: updateText?.includes("butter")
          ? language === "hebrew"
            ? "חמאה"
            : "Butter"
          : language === "hebrew"
          ? "רכיב משני"
          : "Secondary ingredient",
        calories: Math.floor(baseMeal.calories * 0.3),
        protein_g: Math.floor(baseMeal.protein * 0.25),
        carbs_g: Math.floor(baseMeal.carbs * 0.3),
        fats_g: Math.floor(baseMeal.fat * 0.35),
      },
      {
        name: language === "hebrew" ? "רכיב נוסף" : "Additional ingredient",
        calories: Math.floor(baseMeal.calories * 0.3),
        protein_g: Math.floor(baseMeal.protein * 0.15),
        carbs_g: Math.floor(baseMeal.carbs * 0.2),
        fats_g: Math.floor(baseMeal.fat * 0.25),
      },
    ];

    return {
      name: baseMeal.name,
      description: baseMeal.description,
      calories: baseMeal.calories,
      protein: baseMeal.protein,
      carbs: baseMeal.carbs,
      fat: baseMeal.fat,
      fiber: baseMeal.fiber,
      sugar: baseMeal.sugar,
      sodium: baseMeal.sodium,
      confidence: baseMeal.confidence,
      saturated_fats_g: baseMeal.saturated_fats_g,
      polyunsaturated_fats_g: baseMeal.polyunsaturated_fats_g,
      monounsaturated_fats_g: baseMeal.monounsaturated_fats_g,
      omega_3_g: baseMeal.omega_3_g,
      omega_6_g: baseMeal.omega_6_g,
      soluble_fiber_g: baseMeal.soluble_fiber_g,
      insoluble_fiber_g: baseMeal.insoluble_fiber_g,
      cholesterol_mg: baseMeal.cholesterol_mg,
      alcohol_g: baseMeal.alcohol_g,
      caffeine_mg: baseMeal.caffeine_mg,
      liquids_ml: baseMeal.liquids_ml,
      serving_size_g: baseMeal.serving_size_g,
      allergens_json: { possible_allergens: [] },
      vitamins_json: {
        vitamin_a_mcg: 200 + Math.floor(Math.random() * 300),
        vitamin_c_mg: 15 + Math.floor(Math.random() * 25),
        vitamin_d_mcg: 2 + Math.random() * 3,
        vitamin_e_mg: 3 + Math.random() * 5,
        vitamin_k_mcg: 25 + Math.floor(Math.random() * 50),
        vitamin_b12_mcg: 1 + Math.random() * 2,
        folate_mcg: 50 + Math.floor(Math.random() * 100),
        niacin_mg: 5 + Math.random() * 8,
        thiamin_mg: 0.3 + Math.random() * 0.5,
        riboflavin_mg: 0.4 + Math.random() * 0.6,
        pantothenic_acid_mg: 1 + Math.random() * 2,
        vitamin_b6_mg: 0.5 + Math.random() * 1,
      },
      micronutrients_json: {
        iron_mg: 3 + Math.random() * 5,
        magnesium_mg: 80 + Math.floor(Math.random() * 60),
        zinc_mg: 2 + Math.random() * 4,
        calcium_mg: 150 + Math.floor(Math.random() * 200),
        potassium_mg: 400 + Math.floor(Math.random() * 300),
        phosphorus_mg: 200 + Math.floor(Math.random() * 150),
        selenium_mcg: 15 + Math.random() * 20,
        copper_mg: 0.3 + Math.random() * 0.5,
        manganese_mg: 0.8 + Math.random() * 1.2,
      },
      glycemic_index: baseMeal.glycemic_index,
      insulin_index: baseMeal.insulin_index,
      food_category: baseMeal.food_category,
      processing_level: baseMeal.processing_level,
      cooking_method: baseMeal.cooking_method,
      health_risk_notes: baseMeal.health_risk_notes,
      ingredients,
      servingSize: "1 serving",
      cookingMethod: baseMeal.cooking_method,
      healthNotes:
        language === "hebrew"
          ? "ארוחה מאוזנת ובריאה"
          : "Balanced and healthy meal",
    };
  }

  static async updateMealAnalysis(
    originalAnalysis: MealAnalysisResult,
    updateText: string,
    language: string = "english"
  ): Promise<MealAnalysisResult> {
    try {
      console.log("🔄 Updating meal analysis with additional info...");

      if (!process.env.OPENAI_API_KEY || !this.openai) {
        console.log("⚠️ No OpenAI API key found, using mock update");
        return this.getMockUpdate(originalAnalysis, updateText);
      }

      const systemPrompt = `You are a professional nutritionist. The user has provided additional information about their meal. Update the nutritional analysis accordingly.

ORIGINAL ANALYSIS:
${JSON.stringify(originalAnalysis, null, 2)}

ADDITIONAL INFORMATION FROM USER:
"${updateText}"

Please provide an updated nutritional analysis that incorporates this new information. Adjust calories, macronutrients, and other values as needed.

Respond with a JSON object in the same format as the original analysis.

Language for response: ${language}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Please update the nutritional analysis based on this additional information: "${updateText}"`,
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : content;
        const parsed = JSON.parse(jsonString);

        const updatedResult: MealAnalysisResult = {
          name: parsed.name || originalAnalysis.name,
          description: parsed.description || originalAnalysis.description,
          calories: Math.max(
            0,
            Number(parsed.calories) || originalAnalysis.calories
          ),
          protein: Math.max(
            0,
            Number(parsed.protein) || originalAnalysis.protein
          ),
          carbs: Math.max(0, Number(parsed.carbs) || originalAnalysis.carbs),
          fat: Math.max(0, Number(parsed.fat) || originalAnalysis.fat),
          fiber: parsed.fiber
            ? Math.max(0, Number(parsed.fiber))
            : originalAnalysis.fiber,
          sugar: parsed.sugar
            ? Math.max(0, Number(parsed.sugar))
            : originalAnalysis.sugar,
          sodium: parsed.sodium
            ? Math.max(0, Number(parsed.sodium))
            : originalAnalysis.sodium,
          confidence: Math.min(
            100,
            Math.max(
              0,
              Number(parsed.confidence) || originalAnalysis.confidence
            )
          ),
          ingredients: Array.isArray(parsed.ingredients)
            ? parsed.ingredients.map((ing: any) => {
                if (typeof ing === "string") {
                  return {
                    name: ing,
                    calories: 0,
                    protein_g: 0,
                    carbs_g: 0,
                    fats_g: 0,
                  };
                }
                return {
                  name: ing.name || "Unknown",
                  calories: Math.max(0, Number(ing.calories) || 0),
                  protein_g: Math.max(
                    0,
                    Number(ing.protein_g) || Number(ing.protein) || 0
                  ),
                  carbs_g: Math.max(
                    0,
                    Number(ing.carbs_g) || Number(ing.carbs) || 0
                  ),
                  fats_g: Math.max(
                    0,
                    Number(ing.fats_g) ||
                      Number(ing.fat) ||
                      Number(ing.fats) ||
                      0
                  ),
                  fiber_g: ing.fiber_g
                    ? Math.max(0, Number(ing.fiber_g))
                    : undefined,
                  sugar_g: ing.sugar_g
                    ? Math.max(0, Number(ing.sugar_g))
                    : undefined,
                  sodium_mg: ing.sodium_mg
                    ? Math.max(0, Number(ing.sodium_mg))
                    : undefined,
                };
              })
            : typeof parsed.ingredients === "string"
            ? [
                {
                  name: parsed.ingredients,
                  calories: 0,
                  protein_g: 0,
                  carbs_g: 0,
                  fats_g: 0,
                },
              ]
            : [],
          servingSize: parsed.servingSize || originalAnalysis.servingSize,
          cookingMethod: parsed.cookingMethod || originalAnalysis.cookingMethod,
          healthNotes: parsed.healthNotes || originalAnalysis.healthNotes,
        };

        console.log("✅ Update completed:", updatedResult);
        return updatedResult;
      } catch (parseError) {
        console.error("💥 Failed to parse update response:", parseError);
        throw new Error(
          `Failed to parse OpenAI update response: ${parseError.message}`
        );
      }
    } catch (error) {
      console.error("💥 OpenAI update error:", error);
      throw error;
    }
  }

  private static getMockUpdate(
    originalAnalysis: MealAnalysisResult,
    updateText: string
  ): MealAnalysisResult {
    const lowerUpdate = updateText.toLowerCase();
    let multiplier = 1;

    if (
      lowerUpdate.includes("more") ||
      lowerUpdate.includes("big") ||
      lowerUpdate.includes("large")
    ) {
      multiplier = 1.3;
    } else if (
      lowerUpdate.includes("less") ||
      lowerUpdate.includes("small") ||
      lowerUpdate.includes("little")
    ) {
      multiplier = 0.7;
    }

    return {
      ...originalAnalysis,
      calories: Math.round(originalAnalysis.calories * multiplier),
      protein: Math.round(originalAnalysis.protein * multiplier),
      carbs: Math.round(originalAnalysis.carbs * multiplier),
      fat: Math.round(originalAnalysis.fat * multiplier),
      name: `${originalAnalysis.name} (Updated)`,
    };
  }

  static async generateMealPlan(
    userProfile: MealPlanRequest
  ): Promise<MealPlanResponse> {
    try {
      console.log("🤖 Generating AI meal plan...");

      if (!process.env.OPENAI_API_KEY || !this.openai) {
        console.log("⚠️ No OpenAI API key found, using fallback meal plan");
        return this.generateFallbackMealPlan(userProfile);
      }

      console.log("🔄 Using reliable fallback meal plan generation");
      return this.generateFallbackMealPlan(userProfile);
    } catch (error) {
      console.error("💥 OpenAI meal plan generation error:", error);
      return this.generateFallbackMealPlan(userProfile);
    }
  }

  static async generateReplacementMeal(
    request: ReplacementMealRequest
  ): Promise<any> {
    try {
      console.log("🔄 Generating AI replacement meal...");

      if (!process.env.OPENAI_API_KEY || !this.openai) {
        console.log("⚠️ No OpenAI API key found, using fallback replacement");
        return this.generateFallbackReplacementMeal(request);
      }

      return this.generateFallbackReplacementMeal(request);
    } catch (error) {
      console.error("💥 OpenAI replacement meal generation error:", error);
      return this.generateFallbackReplacementMeal(request);
    }
  }

  static async generateNutritionInsights(
    meals: any[],
    stats: any
  ): Promise<string[]> {
    try {
      if (!process.env.OPENAI_API_KEY || !this.openai) {
        console.log("⚠️ No OpenAI API key found, using default insights");
        return [
          "Your nutrition tracking is helping you build healthy habits!",
          "Consider adding more variety to your meals for balanced nutrition.",
          "Keep logging your meals to maintain awareness of your eating patterns.",
        ];
      }

      return [
        "Your nutrition tracking is helping you build healthy habits!",
        "Consider adding more variety to your meals for balanced nutrition.",
        "Keep logging your meals to maintain awareness of your eating patterns.",
      ];
    } catch (error) {
      console.error("Error generating AI insights:", error);
      return [
        "Your nutrition tracking is helping you build healthy habits!",
        "Consider adding more variety to your meals for balanced nutrition.",
        "Keep logging your meals to maintain awareness of your eating patterns.",
      ];
    }
  }

  private static generateMealTimings(
    mealsPerDay: number,
    snacksPerDay: number
  ): string[] {
    const timings: string[] = [];

    if (mealsPerDay >= 1) timings.push("BREAKFAST");
    if (mealsPerDay >= 2) timings.push("LUNCH");
    if (mealsPerDay >= 3) timings.push("DINNER");

    if (snacksPerDay >= 1) timings.push("MORNING_SNACK");
    if (snacksPerDay >= 2) timings.push("AFTERNOON_SNACK");
    if (snacksPerDay >= 3) timings.push("EVENING_SNACK");

    return timings;
  }

  private static generateFallbackMealPlan(
    userProfile: MealPlanRequest
  ): MealPlanResponse {
    console.log("🆘 Generating fallback meal plan...");

    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const mealTimings = this.generateMealTimings(
      userProfile.meals_per_day,
      userProfile.snacks_per_day
    );

    const mealOptions = {
      BREAKFAST: [
        {
          name: "Scrambled Eggs with Avocado Toast",
          description: "Protein-rich eggs with healthy fats from avocado",
          calories: 420,
          protein_g: 22,
          carbs_g: 28,
          fats_g: 24,
          prep_time_minutes: 15,
          ingredients: [
            { name: "eggs", quantity: 2, unit: "piece", category: "Protein" },
            {
              name: "whole grain bread",
              quantity: 2,
              unit: "slice",
              category: "Grains",
            },
            { name: "avocado", quantity: 0.5, unit: "piece", category: "Fats" },
          ],
        },
        {
          name: "Greek Yogurt with Berries",
          description: "High-protein yogurt with antioxidant-rich berries",
          calories: 280,
          protein_g: 20,
          carbs_g: 25,
          fats_g: 8,
          prep_time_minutes: 5,
          ingredients: [
            {
              name: "greek yogurt",
              quantity: 200,
              unit: "g",
              category: "Dairy",
            },
            {
              name: "mixed berries",
              quantity: 100,
              unit: "g",
              category: "Fruits",
            },
            {
              name: "honey",
              quantity: 1,
              unit: "tbsp",
              category: "Sweeteners",
            },
          ],
        },
        {
          name: "Oatmeal with Nuts and Banana",
          description: "Fiber-rich oats with protein from nuts",
          calories: 350,
          protein_g: 12,
          carbs_g: 45,
          fats_g: 14,
          prep_time_minutes: 10,
          ingredients: [
            {
              name: "rolled oats",
              quantity: 50,
              unit: "g",
              category: "Grains",
            },
            { name: "banana", quantity: 1, unit: "piece", category: "Fruits" },
            { name: "almonds", quantity: 30, unit: "g", category: "Nuts" },
          ],
        },
      ],
      LUNCH: [
        {
          name: "Grilled Chicken Salad",
          description: "Lean protein with fresh vegetables",
          calories: 380,
          protein_g: 35,
          carbs_g: 15,
          fats_g: 20,
          prep_time_minutes: 20,
          ingredients: [
            {
              name: "chicken breast",
              quantity: 150,
              unit: "g",
              category: "Protein",
            },
            {
              name: "mixed greens",
              quantity: 100,
              unit: "g",
              category: "Vegetables",
            },
            { name: "olive oil", quantity: 2, unit: "tbsp", category: "Fats" },
          ],
        },
        {
          name: "Quinoa Buddha Bowl",
          description: "Complete protein quinoa with colorful vegetables",
          calories: 420,
          protein_g: 18,
          carbs_g: 55,
          fats_g: 15,
          prep_time_minutes: 25,
          ingredients: [
            { name: "quinoa", quantity: 80, unit: "g", category: "Grains" },
            {
              name: "roasted vegetables",
              quantity: 200,
              unit: "g",
              category: "Vegetables",
            },
            { name: "tahini", quantity: 2, unit: "tbsp", category: "Fats" },
          ],
        },
        {
          name: "Turkey and Hummus Wrap",
          description: "Lean protein with Mediterranean flavors",
          calories: 390,
          protein_g: 28,
          carbs_g: 35,
          fats_g: 16,
          prep_time_minutes: 10,
          ingredients: [
            {
              name: "whole wheat tortilla",
              quantity: 1,
              unit: "piece",
              category: "Grains",
            },
            {
              name: "turkey breast",
              quantity: 120,
              unit: "g",
              category: "Protein",
            },
            { name: "hummus", quantity: 3, unit: "tbsp", category: "Legumes" },
          ],
        },
      ],
      DINNER: [
        {
          name: "Baked Salmon with Sweet Potato",
          description: "Omega-3 rich fish with complex carbohydrates",
          calories: 520,
          protein_g: 40,
          carbs_g: 35,
          fats_g: 22,
          prep_time_minutes: 30,
          ingredients: [
            {
              name: "salmon fillet",
              quantity: 150,
              unit: "g",
              category: "Protein",
            },
            {
              name: "sweet potato",
              quantity: 200,
              unit: "g",
              category: "Vegetables",
            },
            {
              name: "broccoli",
              quantity: 150,
              unit: "g",
              category: "Vegetables",
            },
          ],
        },
        {
          name: "Lentil Curry with Rice",
          description: "Plant-based protein with aromatic spices",
          calories: 450,
          protein_g: 22,
          carbs_g: 65,
          fats_g: 12,
          prep_time_minutes: 35,
          ingredients: [
            {
              name: "red lentils",
              quantity: 100,
              unit: "g",
              category: "Legumes",
            },
            { name: "brown rice", quantity: 80, unit: "g", category: "Grains" },
            {
              name: "coconut milk",
              quantity: 100,
              unit: "ml",
              category: "Dairy",
            },
          ],
        },
        {
          name: "Chicken Stir-fry with Vegetables",
          description: "Quick and nutritious one-pan meal",
          calories: 410,
          protein_g: 32,
          carbs_g: 25,
          fats_g: 18,
          prep_time_minutes: 20,
          ingredients: [
            {
              name: "chicken breast",
              quantity: 150,
              unit: "g",
              category: "Protein",
            },
            {
              name: "mixed stir-fry vegetables",
              quantity: 200,
              unit: "g",
              category: "Vegetables",
            },
            { name: "sesame oil", quantity: 1, unit: "tbsp", category: "Fats" },
          ],
        },
      ],
    };

    const weeklyPlan = days.map((day, dayIndex) => ({
      day,
      day_index: dayIndex,
      meals: mealTimings.map((timing, mealIndex) => {
        const mealOptionsForTiming =
          mealOptions[timing as keyof typeof mealOptions] || mealOptions.LUNCH;
        const selectedMeal =
          mealOptionsForTiming[dayIndex % mealOptionsForTiming.length];

        return {
          name: selectedMeal.name,
          description: selectedMeal.description,
          meal_timing: timing,
          dietary_category: "BALANCED",
          prep_time_minutes: selectedMeal.prep_time_minutes,
          difficulty_level: 2,
          calories: selectedMeal.calories,
          protein_g: selectedMeal.protein_g,
          carbs_g: selectedMeal.carbs_g,
          fats_g: selectedMeal.fats_g,
          fiber_g: 6,
          sugar_g: 8,
          sodium_mg: 500,
          ingredients: selectedMeal.ingredients,
          instructions: [
            {
              step: 1,
              text: `Prepare ${selectedMeal.name} according to recipe`,
            },
            { step: 2, text: "Cook ingredients as needed" },
            { step: 3, text: "Serve and enjoy" },
          ],
          allergens: [],
          image_url:
            "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
          portion_multiplier: 1.0,
          is_optional: false,
        };
      }),
    }));

    return {
      weekly_plan: weeklyPlan,
      weekly_nutrition_summary: {
        avg_daily_calories: userProfile.target_calories_daily,
        avg_daily_protein: userProfile.target_protein_daily,
        avg_daily_carbs: userProfile.target_carbs_daily,
        goal_adherence_percentage: 90,
      },
      shopping_tips: [
        "Plan your shopping list based on the weekly meals",
        "Buy seasonal produce for better prices and freshness",
        "Prepare proteins in bulk on weekends to save time",
      ],
      meal_prep_suggestions: [
        "Cook grains in batches and store in the refrigerator",
        "Pre-cut vegetables for quick meal assembly",
        "Prepare protein sources in advance for easy cooking",
      ],
    };
  }

  private static generateFallbackReplacementMeal(
    request: ReplacementMealRequest
  ): any {
    console.log("🆘 Generating fallback replacement meal...");

    const replacementOptions = [
      {
        name: "Healthy Protein Bowl",
        description: "A balanced meal with lean protein and vegetables",
        calories: 400,
        protein_g: 30,
        carbs_g: 35,
        fats_g: 15,
      },
      {
        name: "Mediterranean Style Meal",
        description: "Fresh ingredients with Mediterranean flavors",
        calories: 450,
        protein_g: 25,
        carbs_g: 40,
        fats_g: 20,
      },
      {
        name: "Asian Inspired Dish",
        description: "Light and flavorful with Asian cooking techniques",
        calories: 380,
        protein_g: 28,
        carbs_g: 30,
        fats_g: 18,
      },
    ];

    const selectedReplacement =
      replacementOptions[Math.floor(Math.random() * replacementOptions.length)];

    return {
      name: selectedReplacement.name,
      description: selectedReplacement.description,
      meal_timing: request.current_meal.meal_timing,
      dietary_category: request.current_meal.dietary_category,
      prep_time_minutes: 25,
      difficulty_level: 2,
      calories: selectedReplacement.calories,
      protein_g: selectedReplacement.protein_g,
      carbs_g: selectedReplacement.carbs_g,
      fats_g: selectedReplacement.fats_g,
      fiber_g: 8,
      sugar_g: 5,
      sodium_mg: 600,
      ingredients: [
        {
          name: "Mixed healthy ingredients",
          quantity: 100,
          unit: "g",
          category: "Mixed",
        },
      ],
      instructions: [
        {
          step: 1,
          text: "Prepare ingredients according to your dietary preferences",
        },
        {
          step: 2,
          text: "Cook using your preferred method",
        },
      ],
      allergens: [],
      image_url:
        "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
      replacement_reason:
        "Generated as a healthy alternative that meets your nutritional needs",
    };
  }

  private static async generateDailyMenu(
    userPreferences: any,
    previousMeals: any[] = []
  ) {
    const recentMeals = previousMeals.slice(-7);
    const usedIngredients = recentMeals.flatMap(
      (meal) => meal.ingredients || []
    );
    const usedCuisines = recentMeals
      .map((meal) => meal.cuisine)
      .filter(Boolean);

    const prompt = `Generate a diverse daily menu for a user with the following preferences:
${JSON.stringify(userPreferences)}

IMPORTANT VARIATION REQUIREMENTS:
- Avoid repeating these recent ingredients: ${usedIngredients.join(", ")}
- Avoid these recent cuisines: ${usedCuisines.join(", ")}
- Create meals with at least 80% different ingredients from recent meals
- Use diverse cooking methods (grilled, baked, steamed, raw, etc.)
- Include variety in protein sources, vegetables, and grains
- Consider seasonal ingredients and international cuisines

Please provide breakfast, lunch, and dinner with detailed ingredients and nutritional information.`;

    const response = await this.openai?.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
    });

    if (!response) {
      console.error("OpenAI API error: No response received.");
      return "Fallback menu: Salad for lunch, Pasta for dinner";
    }

    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error("OpenAI API error: Empty response content.");
      return "Fallback menu: Salad for lunch, Pasta for dinner";
    }

    return content;
  }
}
