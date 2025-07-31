import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Camera, CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { BarCodeScanner } from "expo-barcode-scanner";
import {
  Scan,
  Camera as CameraIcon,
  Image as ImageIcon,
  Package,
  Search,
  History,
  X,
  Check,
  Plus,
  Sparkles,
  AlertTriangle,
  Moon,
  Sun,
  ShoppingCart,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import { foodScannerAPI } from "@/src/services/api";
import LoadingScreen from "@/components/LoadingScreen";

const { width, height } = Dimensions.get("window");

interface ProductData {
  name: string;
  brand?: string;
  category: string;
  nutrition_per_100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
  ingredients: string[];
  allergens: string[];
  labels: string[];
  health_score?: number;
  barcode?: string;
}

export default function FoodScannerScreen() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { isDark, toggleTheme, colors } = useTheme();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [scanMode, setScanMode] = useState<'barcode' | 'image'>('barcode');
  const [scannedData, setScannedData] = useState<ProductData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [showAddToMeal, setShowAddToMeal] = useState(false);
  const [quantity, setQuantity] = useState("100");
  const [mealTiming, setMealTiming] = useState("SNACK");

  const cameraRef = useRef<CameraView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    getCameraPermissions();
    loadScanHistory();
    
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === "granted");
  };

  const loadScanHistory = async () => {
    try {
      const response = await foodScannerAPI.getScannedHistory();
      if (response.success) {
        setScanHistory(response.data || []);
      }
    } catch (error) {
      console.error("Error loading scan history:", error);
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (isScanning) return;
    
    setIsScanning(true);
    try {
      console.log("📱 Barcode scanned:", data);
      const response = await foodScannerAPI.scanBarcode(data);
      
      if (response.success && response.data) {
        setScannedData(response.data.product);
        setShowCamera(false);
        setShowAddToMeal(true);
      } else {
        Alert.alert("Product Not Found", "This product is not in our database");
      }
    } catch (error) {
      console.error("Barcode scan error:", error);
      Alert.alert("Scan Failed", "Failed to scan barcode. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const scanProductImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setIsScanning(true);
        
        const response = await foodScannerAPI.scanProductImage(
          result.assets[0].base64 || ""
        );
        
        if (response.success && response.data) {
          setScannedData(response.data.product);
          setShowAddToMeal(true);
        } else {
          Alert.alert("Scan Failed", "Could not identify product from image");
        }
        
        setIsScanning(false);
      }
    } catch (error) {
      console.error("Image scan error:", error);
      Alert.alert("Scan Failed", "Failed to scan image. Please try again.");
      setIsScanning(false);
    }
  };

  const addToMealLog = async () => {
    if (!scannedData) return;

    try {
      const response = await foodScannerAPI.addToMealLog(
        scannedData,
        parseInt(quantity),
        mealTiming
      );

      if (response.success) {
        Alert.alert("Success", "Product added to meal log!", [
          {
            text: "OK",
            onPress: () => {
              setShowAddToMeal(false);
              setScannedData(null);
              loadScanHistory();
            },
          },
        ]);
      }
    } catch (error) {
      console.error("Add to meal error:", error);
      Alert.alert("Error", "Failed to add product to meal log");
    }
  };

  if (hasPermission === null) {
    return (
      <LoadingScreen
        text={isRTL ? "בודק הרשאות..." : "Checking permissions..."}
      />
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionText, { color: colors.text }]}>
          {t("camera.permission")}
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          onPress={getCameraPermissions}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Camera view for barcode scanning
  if (showCamera && scanMode === 'barcode') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          barCodeScannerSettings={{
            barCodeTypes: [BarCodeScanner.Constants.BarCodeType.ean13, BarCodeScanner.Constants.BarCodeType.ean8],
          }}
          onBarcodeScanned={handleBarCodeScanned}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.3)']}
            style={styles.cameraOverlay}
          >
            {/* Header */}
            <View style={styles.cameraHeader}>
              <TouchableOpacity
                style={styles.cameraHeaderButton}
                onPress={() => setShowCamera(false)}
              >
                <BlurView intensity={20} style={styles.blurButton}>
                  <X size={24} color="#FFFFFF" />
                </BlurView>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cameraHeaderButton}
                onPress={toggleTheme}
              >
                <BlurView intensity={20} style={styles.blurButton}>
                  {isDark ? <Sun size={24} color="#FFFFFF" /> : <Moon size={24} color="#FFFFFF" />}
                </BlurView>
              </TouchableOpacity>
            </View>

            {/* Scanning guide */}
            <View style={styles.scanGuide}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanText}>
                {t("food_scanner.barcode_instructions")}
              </Text>
            </View>

            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'barcode' && styles.modeButtonActive]}
                onPress={() => setScanMode('barcode')}
              >
                <BlurView intensity={20} style={styles.blurButton}>
                  <Scan size={20} color="#FFFFFF" />
                  <Text style={styles.modeButtonText}>Barcode</Text>
                </BlurView>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'image' && styles.modeButtonActive]}
                onPress={() => {
                  setScanMode('image');
                  setShowCamera(false);
                  scanProductImage();
                }}
              >
                <BlurView intensity={20} style={styles.blurButton}>
                  <ImageIcon size={20} color="#FFFFFF" />
                  <Text style={styles.modeButtonText}>Image</Text>
                </BlurView>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={colors.background} 
      />

      {/* Modern Header */}
      <LinearGradient
        colors={colors.gradientLight}
        style={styles.modernHeader}
      >
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: colors.primary + '20' }]}>
                <Scan size={24} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {t("food_scanner.title")}
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  Scan barcodes or analyze food images
                </Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerActionButton, { backgroundColor: colors.surface }]}
                onPress={toggleTheme}
              >
                {isDark ? (
                  <Sun size={20} color={colors.primary} />
                ) : (
                  <Moon size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <Animated.ScrollView 
        style={[styles.content, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scan Options */}
        <Animated.View 
          style={[
            styles.scanOptions,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={colors.gradientLight}
            style={styles.scanOptionsCard}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Choose Scan Method
            </Text>
            
            <View style={styles.scanButtonsGrid}>
              <TouchableOpacity
                style={[styles.scanOptionButton, { backgroundColor: colors.surface }]}
                onPress={() => {
                  setScanMode('barcode');
                  setShowCamera(true);
                }}
              >
                <LinearGradient
                  colors={colors.gradient}
                  style={styles.scanOptionIcon}
                >
                  <Scan size={24} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.scanOptionTitle, { color: colors.text }]}>
                  Scan Barcode
                </Text>
                <Text style={[styles.scanOptionDesc, { color: colors.textSecondary }]}>
                  Point camera at product barcode
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.scanOptionButton, { backgroundColor: colors.surface }]}
                onPress={scanProductImage}
              >
                <LinearGradient
                  colors={[colors.secondary, '#8b5cf6']}
                  style={styles.scanOptionIcon}
                >
                  <ImageIcon size={24} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.scanOptionTitle, { color: colors.text }]}>
                  Scan Image
                </Text>
                <Text style={[styles.scanOptionDesc, { color: colors.textSecondary }]}>
                  Upload nutrition label photo
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Scan History */}
        {scanHistory.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <History size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Recent Scans
              </Text>
            </View>
            
            <View style={styles.historyList}>
              {scanHistory.slice(0, 5).map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.historyItem, { 
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                  }]}
                >
                  <View style={[styles.historyIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Package size={16} color={colors.primary} />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={[styles.historyTitle, { color: colors.text }]}>
                      {item.product_name || item.name}
                    </Text>
                    <Text style={[styles.historyDate, { color: colors.textLight }]}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.historyCategory, { color: colors.primary }]}>
                    {item.category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Loading State */}
        {isScanning && (
          <View style={styles.loadingContainer}>
            <LinearGradient
              colors={colors.gradientLight}
              style={styles.loadingCard}
            >
              <View style={[styles.loadingIcon, { backgroundColor: colors.primary + '20' }]}>
                <Sparkles size={48} color={colors.primary} />
              </View>
              <Text style={[styles.loadingTitle, { color: colors.text }]}>
                Analyzing Product...
              </Text>
              <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
                Please wait while we identify the product
              </Text>
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.loader}
              />
            </LinearGradient>
          </View>
        )}
      </Animated.ScrollView>

      {/* Add to Meal Modal */}
      <Modal
        visible={showAddToMeal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddToMeal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} style={styles.modalBlur}>
            <View style={[styles.addToMealModal, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Add to Meal Log
                </Text>
                <TouchableOpacity onPress={() => setShowAddToMeal(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {scannedData && (
                <>
                  <View style={[styles.productInfo, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.productName, { color: colors.text }]}>
                      {scannedData.name}
                    </Text>
                    {scannedData.brand && (
                      <Text style={[styles.productBrand, { color: colors.textSecondary }]}>
                        {scannedData.brand}
                      </Text>
                    )}
                    <Text style={[styles.productCategory, { color: colors.primary }]}>
                      {scannedData.category}
                    </Text>
                  </View>

                  <View style={styles.nutritionPreview}>
                    <Text style={[styles.nutritionTitle, { color: colors.text }]}>
                      Nutrition per 100g
                    </Text>
                    <View style={styles.nutritionGrid}>
                      <View style={[styles.nutritionItem, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.nutritionValue, { color: colors.text }]}>
                          {scannedData.nutrition_per_100g.calories}
                        </Text>
                        <Text style={[styles.nutritionLabel, { color: colors.textLight }]}>
                          Calories
                        </Text>
                      </View>
                      <View style={[styles.nutritionItem, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.nutritionValue, { color: colors.text }]}>
                          {scannedData.nutrition_per_100g.protein}g
                        </Text>
                        <Text style={[styles.nutritionLabel, { color: colors.textLight }]}>
                          Protein
                        </Text>
                      </View>
                      <View style={[styles.nutritionItem, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.nutritionValue, { color: colors.text }]}>
                          {scannedData.nutrition_per_100g.carbs}g
                        </Text>
                        <Text style={[styles.nutritionLabel, { color: colors.textLight }]}>
                          Carbs
                        </Text>
                      </View>
                      <View style={[styles.nutritionItem, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.nutritionValue, { color: colors.text }]}>
                          {scannedData.nutrition_per_100g.fat}g
                        </Text>
                        <Text style={[styles.nutritionLabel, { color: colors.textLight }]}>
                          Fat
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.quantitySection}>
                    <Text style={[styles.quantityLabel, { color: colors.text }]}>
                      Quantity (grams)
                    </Text>
                    <TextInput
                      style={[styles.quantityInput, { 
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text
                      }]}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                      placeholder="100"
                      placeholderTextColor={colors.textLight}
                    />
                  </View>

                  <View style={styles.mealTimingSection}>
                    <Text style={[styles.mealTimingLabel, { color: colors.text }]}>
                      Meal Timing
                    </Text>
                    <View style={styles.mealTimingButtons}>
                      {['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'].map((timing) => (
                        <TouchableOpacity
                          key={timing}
                          style={[
                            styles.mealTimingButton,
                            { 
                              backgroundColor: mealTiming === timing ? colors.primary : colors.surface,
                              borderColor: colors.border
                            }
                          ]}
                          onPress={() => setMealTiming(timing)}
                        >
                          <Text style={[
                            styles.mealTimingText,
                            { color: mealTiming === timing ? '#FFFFFF' : colors.text }
                          ]}>
                            {timing}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={addToMealLog}
                  >
                    <ShoppingCart size={20} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Add to Meal Log</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Modern Header
  modernHeader: {
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },

  // Scan Options
  scanOptions: {
    marginBottom: 24,
  },
  scanOptionsCard: {
    borderRadius: 24,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  scanButtonsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  scanOptionButton: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  scanOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scanOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  scanOptionDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },

  // History
  historySection: {
    marginBottom: 24,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
  },
  historyCategory: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Camera
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  cameraHeaderButton: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  blurButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanGuide: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  scanFrame: {
    width: width * 0.7,
    height: 120,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  scanText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 16,
  },
  modeButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  modeButtonActive: {
    opacity: 1,
  },
  modeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingCard: {
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
  },
  loader: {
    marginTop: 16,
  },

  // Permission
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  addToMealModal: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
    width: width - 40,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  productInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 14,
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  nutritionPreview: {
    marginBottom: 20,
  },
  nutritionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  nutritionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  nutritionItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  quantitySection: {
    marginBottom: 20,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  quantityInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  mealTimingSection: {
    marginBottom: 24,
  },
  mealTimingLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  mealTimingButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealTimingButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  mealTimingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});