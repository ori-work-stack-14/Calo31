import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar,
  Animated,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import {
  ChefHat,
  Plus,
  Sparkles,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Moon,
  Sun,
  X,
  Settings,
  Filter,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/services/api";
import LoadingScreen from "@/components/LoadingScreen";
import MenuCard from "@/components/MenuCard";

const { width } = Dimensions.get("window");

interface RecommendedMenu {
  menu_id: string;
  title: string;
  description?: string;
  total_calories: number;
  total_protein?: number;
  total_carbs?: number;
  total_fat?: number;
  days_count: number;
  estimated_cost?: number;
  meals: any[];
  created_at: string;
}

export default function RecommendedMenusScreen() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { isDark, toggleTheme, colors } = useTheme();

  const [menus, setMenus] = useState<RecommendedMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customRequest, setCustomRequest] = useState("");
  const [selectedDays, setSelectedDays] = useState(7);
  const [selectedBudget, setSelectedBudget] = useState(200);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadRecommendedMenus();
    
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

  const loadRecommendedMenus = async () => {
    try {
      console.log("📋 Loading recommended menus...");
      const response = await api.get("/recommended-menus");
      
      if (response.data.success) {
        setMenus(response.data.data || []);
        console.log("✅ Loaded", response.data.data?.length || 0, "menus");
      }
    } catch (error) {
      console.error("💥 Error loading menus:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecommendedMenus();
    setRefreshing(false);
  };

  const generateNewMenu = async () => {
    try {
      setIsGenerating(true);
      console.log("🤖 Generating new menu...");

      const response = await api.post("/recommended-menus/generate", {
        days: 7,
        mealsPerDay: "3_main",
        mealChangeFrequency: "daily",
        includeLeftovers: false,
        sameMealTimes: true,
      });

      if (response.data.success) {
        console.log("✅ Menu generated successfully");
        await loadRecommendedMenus();
        Alert.alert("Success", "New menu generated successfully!");
      } else {
        throw new Error(response.data.error || "Failed to generate menu");
      }
    } catch (error: any) {
      console.error("💥 Error generating menu:", error);
      Alert.alert("Error", error.message || "Failed to generate menu");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCustomMenu = async () => {
    if (!customRequest.trim()) {
      Alert.alert("Error", "Please describe what kind of menu you want");
      return;
    }

    try {
      setIsGenerating(true);
      console.log("🎨 Generating custom menu...");

      const response = await api.post("/recommended-menus/generate-custom", {
        customRequest: customRequest.trim(),
        days: selectedDays,
        mealsPerDay: "3_main",
        budget: selectedBudget,
        mealChangeFrequency: "daily",
        includeLeftovers: false,
        sameMealTimes: true,
      });

      if (response.data.success) {
        console.log("✅ Custom menu generated successfully");
        setShowCustomModal(false);
        setCustomRequest("");
        await loadRecommendedMenus();
        Alert.alert("Success", "Custom menu generated successfully!");
      } else {
        throw new Error(response.data.error || "Failed to generate custom menu");
      }
    } catch (error: any) {
      console.error("💥 Error generating custom menu:", error);
      Alert.alert("Error", error.message || "Failed to generate custom menu");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartMenu = async (menuId: string) => {
    try {
      console.log("🚀 Starting menu:", menuId);
      
      const response = await api.post(`/recommended-menus/${menuId}/start-today`);
      
      if (response.data.success) {
        Alert.alert("Success", "Menu started for today!");
      }
    } catch (error) {
      console.error("💥 Error starting menu:", error);
      Alert.alert("Error", "Failed to start menu");
    }
  };

  if (isLoading) {
    return (
      <LoadingScreen
        text={isRTL ? "טוען תפריטים..." : "Loading menus..."}
      />
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
                <ChefHat size={24} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {t("recommended_menus.title")}
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  {t("recommended_menus.personalized_for_you")}
                </Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerActionButton, { backgroundColor: colors.surface }]}
                onPress={() => setShowCustomModal(true)}
              >
                <Plus size={20} color={colors.primary} />
              </TouchableOpacity>
              
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Generate Menu Button */}
        <Animated.View 
          style={[
            styles.generateSection,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: colors.primary }]}
            onPress={generateNewMenu}
            disabled={isGenerating}
          >
            <LinearGradient
              colors={colors.gradient}
              style={styles.generateButtonGradient}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Sparkles size={20} color="#FFFFFF" />
              )}
              <Text style={styles.generateButtonText}>
                {isGenerating ? "Generating..." : "Generate New Menu"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Menus List */}
        {menus.length > 0 ? (
          <View style={styles.menusSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your Personalized Menus
            </Text>
            
            {menus.map((menu, index) => (
              <MenuCard
                key={menu.menu_id}
                menu={menu}
                isRTL={isRTL}
                onStart={handleStartMenu}
                fadeAnim={fadeAnim}
                slideAnim={slideAnim}
                index={index}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={colors.gradientLight}
              style={styles.emptyStateCard}
            >
              <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '20' }]}>
                <ChefHat size={48} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Menus Yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Generate your first personalized menu to get started
              </Text>
            </LinearGradient>
          </View>
        )}
      </Animated.ScrollView>

      {/* Custom Menu Modal */}
      <Modal
        visible={showCustomModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} style={styles.modalBlur}>
            <View style={[styles.customModal, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Create Custom Menu
                </Text>
                <TouchableOpacity onPress={() => setShowCustomModal(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                <View style={styles.inputSection}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    Describe your ideal menu
                  </Text>
                  <TextInput
                    style={[styles.textInput, { 
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text
                    }]}
                    placeholder="e.g., 'High protein meals for weight loss' or 'Mediterranean diet for 2 weeks'"
                    placeholderTextColor={colors.textLight}
                    value={customRequest}
                    onChangeText={setCustomRequest}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.optionsRow}>
                  <View style={styles.optionItem}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      Days
                    </Text>
                    <View style={styles.optionButtons}>
                      {[3, 7, 14].map((days) => (
                        <TouchableOpacity
                          key={days}
                          style={[
                            styles.optionButton,
                            { 
                              backgroundColor: selectedDays === days ? colors.primary : colors.surface,
                              borderColor: colors.border
                            }
                          ]}
                          onPress={() => setSelectedDays(days)}
                        >
                          <Text style={[
                            styles.optionButtonText,
                            { color: selectedDays === days ? '#FFFFFF' : colors.text }
                          ]}>
                            {days}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.optionItem}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      Budget (₪/day)
                    </Text>
                    <View style={styles.optionButtons}>
                      {[100, 200, 300].map((budget) => (
                        <TouchableOpacity
                          key={budget}
                          style={[
                            styles.optionButton,
                            { 
                              backgroundColor: selectedBudget === budget ? colors.primary : colors.surface,
                              borderColor: colors.border
                            }
                          ]}
                          onPress={() => setSelectedBudget(budget)}
                        >
                          <Text style={[
                            styles.optionButtonText,
                            { color: selectedBudget === budget ? '#FFFFFF' : colors.text }
                          ]}>
                            ₪{budget}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.generateCustomButton, { backgroundColor: colors.primary }]}
                  onPress={generateCustomMenu}
                  disabled={isGenerating || !customRequest.trim()}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Sparkles size={20} color="#FFFFFF" />
                      <Text style={styles.generateCustomButtonText}>
                        Generate Custom Menu
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
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

  // Generate Section
  generateSection: {
    marginBottom: 24,
  },
  generateButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 8,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Menus Section
  menusSection: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  // Empty State
  emptyState: {
    flex: 1,
    minHeight: 400,
  },
  emptyStateCard: {
    flex: 1,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.8,
  },

  // Modal
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
  customModal: {
    margin: 20,
    borderRadius: 20,
    width: width - 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 24,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionsRow: {
    gap: 20,
    marginBottom: 24,
  },
  optionItem: {
    gap: 8,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  generateCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  generateCustomButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});