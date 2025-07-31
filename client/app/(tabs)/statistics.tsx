import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  BarChart3,
  TrendingUp,
  Target,
  Calendar,
  Award,
  Flame,
  Zap,
  Droplets,
  Moon,
  Sun,
  ChevronDown,
  Filter,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import { useStatistics } from "@/hooks/useQueries";
import LoadingScreen from "@/components/LoadingScreen";

const { width } = Dimensions.get("window");

const TIME_RANGES = [
  { key: "today", label: "Today", icon: "📅" },
  { key: "week", label: "This Week", icon: "📊" },
  { key: "month", label: "This Month", icon: "📈" },
  { key: "custom", label: "Custom", icon: "🎯" },
];

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { isDark, toggleTheme, colors } = useTheme();

  const [selectedTimeRange, setSelectedTimeRange] = useState("week");
  const [showTimeRangePicker, setShowTimeRangePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Get statistics data
  const { data: statisticsData, isLoading, error, refetch } = useStatistics(
    selectedTimeRange,
    customStartDate,
    customEndDate
  );

  useEffect(() => {
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

  const handleTimeRangeChange = (range: string) => {
    setSelectedTimeRange(range);
    setShowTimeRangePicker(false);
    
    if (range !== "custom") {
      setCustomStartDate("");
      setCustomEndDate("");
    }
  };

  const renderStatCard = (
    title: string,
    value: string | number,
    subtitle: string,
    icon: React.ReactNode,
    gradient: string[]
  ) => (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <LinearGradient
        colors={gradient}
        style={styles.statCardGradient}
      >
        <View style={styles.statCardHeader}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            {icon}
          </View>
          <Text style={styles.statValue}>{value}</Text>
        </View>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statSubtitle}>{subtitle}</Text>
      </LinearGradient>
    </View>
  );

  const renderNutritionBar = (
    label: string,
    current: number,
    target: number,
    color: string,
    unit: string = "g"
  ) => {
    const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    
    return (
      <View style={styles.nutritionBar}>
        <View style={styles.nutritionBarHeader}>
          <Text style={[styles.nutritionBarLabel, { color: colors.text }]}>
            {label}
          </Text>
          <Text style={[styles.nutritionBarValue, { color: colors.textSecondary }]}>
            {current.toFixed(1)}{unit} / {target}{unit}
          </Text>
        </View>
        <View style={[styles.nutritionBarTrack, { backgroundColor: colors.borderLight }]}>
          <View
            style={[
              styles.nutritionBarFill,
              { 
                width: `${percentage}%`,
                backgroundColor: color
              }
            ]}
          />
        </View>
        <Text style={[styles.nutritionBarPercentage, { color }]}>
          {percentage.toFixed(0)}%
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <LoadingScreen
        text={isRTL ? "טוען סטטיסטיקות..." : "Loading statistics..."}
      />
    );
  }

  const stats = statisticsData?.data || {};

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
                <BarChart3 size={24} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {t("statistics.title")}
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  Track your nutrition progress
                </Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerActionButton, { backgroundColor: colors.surface }]}
                onPress={() => setShowTimeRangePicker(true)}
              >
                <Filter size={20} color={colors.primary} />
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
      >
        {/* Time Range Selector */}
        <Animated.View 
          style={[
            styles.timeRangeSelector,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <TouchableOpacity
            style={[styles.timeRangeButton, { 
              backgroundColor: colors.surface,
              borderColor: colors.border
            }]}
            onPress={() => setShowTimeRangePicker(true)}
          >
            <Text style={[styles.timeRangeText, { color: colors.text }]}>
              {TIME_RANGES.find(r => r.key === selectedTimeRange)?.label || "This Week"}
            </Text>
            <ChevronDown size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Overview Stats */}
        <View style={styles.overviewSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Overview
          </Text>
          
          <View style={styles.statsGrid}>
            {renderStatCard(
              "Average Calories",
              stats.averageCalories || 0,
              "Daily intake",
              <Flame size={20} color="#FFFFFF" />,
              ['#ef4444', '#dc2626']
            )}
            
            {renderStatCard(
              "Protein Goal",
              `${((stats.averageProtein || 0) / 120 * 100).toFixed(0)}%`,
              "Target achievement",
              <Zap size={20} color="#FFFFFF" />,
              ['#8b5cf6', '#7c3aed']
            )}
            
            {renderStatCard(
              "Current Streak",
              stats.currentStreak || 0,
              "Days in a row",
              <Award size={20} color="#FFFFFF" />,
              colors.gradient
            )}
            
            {renderStatCard(
              "Total Days",
              stats.totalDays || 0,
              "Tracking period",
              <Calendar size={20} color="#FFFFFF" />,
              ['#06b6d4', '#0891b2']
            )}
          </View>
        </View>

        {/* Nutrition Breakdown */}
        <View style={styles.nutritionSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Nutrition Breakdown
          </Text>
          
          <View style={[styles.nutritionCard, { backgroundColor: colors.surface }]}>
            {renderNutritionBar("Protein", stats.averageProtein || 0, 120, '#8b5cf6')}
            {renderNutritionBar("Carbs", stats.averageCarbs || 0, 250, '#f59e0b')}
            {renderNutritionBar("Fats", stats.averageFats || 0, 67, '#ef4444')}
            {renderNutritionBar("Fiber", stats.averageFiber || 0, 25, '#10b981')}
            {renderNutritionBar("Sodium", (stats.averageSodium || 0) / 1000, 2.3, '#f97316', 'g')}
          </View>
        </View>

        {/* Achievements */}
        {stats.achievements && stats.achievements.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Achievements
            </Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.achievementsList}>
                {stats.achievements.slice(0, 5).map((achievement: any, index: number) => (
                  <View 
                    key={index}
                    style={[styles.achievementCard, { backgroundColor: colors.surface }]}
                  >
                    <View style={[styles.achievementIcon, { backgroundColor: colors.primary + '20' }]}>
                      <Award size={20} color={colors.primary} />
                    </View>
                    <Text style={[styles.achievementTitle, { color: colors.text }]}>
                      {achievement.title}
                    </Text>
                    <Text style={[styles.achievementDesc, { color: colors.textSecondary }]}>
                      {achievement.description}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Daily Breakdown */}
        {stats.dailyBreakdown && stats.dailyBreakdown.length > 0 && (
          <View style={styles.dailySection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Daily Breakdown
            </Text>
            
            <View style={styles.dailyList}>
              {stats.dailyBreakdown.slice(0, 7).map((day: any, index: number) => (
                <View 
                  key={index}
                  style={[styles.dailyItem, { 
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                  }]}
                >
                  <View style={styles.dailyDate}>
                    <Text style={[styles.dailyDateText, { color: colors.text }]}>
                      {new Date(day.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </View>
                  
                  <View style={styles.dailyNutrition}>
                    <View style={styles.dailyNutritionItem}>
                      <Flame size={14} color="#ef4444" />
                      <Text style={[styles.dailyNutritionValue, { color: colors.text }]}>
                        {Math.round(day.calories || 0)}
                      </Text>
                    </View>
                    <View style={styles.dailyNutritionItem}>
                      <Zap size={14} color="#8b5cf6" />
                      <Text style={[styles.dailyNutritionValue, { color: colors.text }]}>
                        {Math.round(day.protein_g || 0)}g
                      </Text>
                    </View>
                    <View style={styles.dailyNutritionItem}>
                      <Droplets size={14} color="#06b6d4" />
                      <Text style={[styles.dailyNutritionValue, { color: colors.text }]}>
                        {day.water_cups || 0}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={[
                    styles.dailyStatus,
                    { backgroundColor: (day.calories || 0) >= 1800 ? colors.success + '20' : colors.warning + '20' }
                  ]}>
                    <Text style={[
                      styles.dailyStatusText,
                      { color: (day.calories || 0) >= 1800 ? colors.success : colors.warning }
                    ]}>
                      {(day.calories || 0) >= 1800 ? "✓" : "!"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </Animated.ScrollView>

      {/* Time Range Picker Modal */}
      <Modal
        visible={showTimeRangePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTimeRangePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} style={styles.modalBlur}>
            <View style={[styles.timeRangeModal, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Time Range
                </Text>
                <TouchableOpacity onPress={() => setShowTimeRangePicker(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.timeRangeOptions}>
                {TIME_RANGES.map((range) => (
                  <TouchableOpacity
                    key={range.key}
                    style={[
                      styles.timeRangeOption,
                      { 
                        backgroundColor: selectedTimeRange === range.key ? colors.primary + '15' : colors.surface,
                        borderColor: selectedTimeRange === range.key ? colors.primary : colors.border
                      }
                    ]}
                    onPress={() => handleTimeRangeChange(range.key)}
                  >
                    <Text style={styles.timeRangeIcon}>{range.icon}</Text>
                    <Text style={[
                      styles.timeRangeLabel,
                      { color: selectedTimeRange === range.key ? colors.primary : colors.text }
                    ]}>
                      {range.label}
                    </Text>
                    {selectedTimeRange === range.key && (
                      <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]}>
                        <Check size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
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

  // Time Range Selector
  timeRangeSelector: {
    marginBottom: 24,
  },
  timeRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  timeRangeText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Overview Section
  overviewSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - 60) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statCardGradient: {
    padding: 20,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },

  // Nutrition Section
  nutritionSection: {
    marginBottom: 32,
  },
  nutritionCard: {
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  nutritionBar: {
    gap: 8,
  },
  nutritionBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutritionBarLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  nutritionBarValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  nutritionBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  nutritionBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  nutritionBarPercentage: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Achievements Section
  achievementsSection: {
    marginBottom: 32,
  },
  achievementsList: {
    flexDirection: 'row',
    gap: 16,
    paddingRight: 24,
  },
  achievementCard: {
    width: 140,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achievementTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },

  // Daily Section
  dailySection: {
    marginBottom: 32,
  },
  dailyList: {
    gap: 12,
  },
  dailyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  dailyDate: {
    width: 60,
    alignItems: 'center',
  },
  dailyDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dailyNutrition: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  dailyNutritionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dailyNutritionValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  dailyStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBlur: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  timeRangeModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeRangeOptions: {
    gap: 12,
  },
  timeRangeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  timeRangeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  timeRangeLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});