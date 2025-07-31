import {
  SplashScreen,
  Stack,
} from "expo-router";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/src/store";
import { StatusBar } from "expo-status-bar";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppInitialization } from "@/hooks/useAppInitialization";
import { ThemeProvider } from "@/src/contexts/ThemeContext";
import { useSelector } from "react-redux";
import { RootState } from "@/src/store";
import { useRouter, useSegments } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { queryClient } from "@/src/providers/QueryProvider";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "@/src/i18n"; // Initialize i18n
import { LanguageProvider } from "@/src/i18n/context/LanguageContext";
import { useFonts } from "expo-font";
import "react-native-reanimated";
import { I18nextProvider } from "react-i18next";
import i18n from "@/src/i18n";
import { User } from "@/src/types";
import LanguageToolbar from "@/components/LanguageToolbar";
import { NotificationService } from "@/src/services/notifications";

SplashScreen.preventAutoHideAsync();

// Memoized selector to prevent unnecessary re-renders
const selectAuthState = (state: RootState) => ({
  isAuthenticated: state.auth.isAuthenticated,
  user: state.auth.user,
});

// Memoized navigation state calculator
function useNavigationState(
  user: User | null,
  isAuthenticated: boolean,
  segments: string[]
) {
  return useMemo(() => {
    const currentPath = segments?.[0] || "";
    const inAuthGroup = currentPath === "(auth)";
    const inTabsGroup = currentPath === "(tabs)";
    const onPaymentPlan = currentPath === "payment-plan";
    const onQuestionnaire = currentPath === "questionnaire";
    const onEmailVerification =
      inAuthGroup && segments?.[1] === "email-verification";

    // Create current route string for comparison
    const currentRoute = "/" + segments.join("/");

    let targetRoute: string | null = null;

    if (!isAuthenticated || !user) {
      if (!inAuthGroup) {
        targetRoute = "/(auth)/signin";
      }
    } else if (user?.email_verified === false && !onEmailVerification) {
      targetRoute = `/(auth)/email-verification?email=${user?.email || ""}`;
    } else if (!user?.subscription_type && !onPaymentPlan) {
      targetRoute = "/payment-plan";
    } else if (
      user?.subscription_type &&
      ["PREMIUM", "GOLD"].includes(user.subscription_type) &&
      !user?.is_questionnaire_completed &&
      !onQuestionnaire
    ) {
      targetRoute = "/questionnaire";
    } else if (
      !inTabsGroup &&
      isAuthenticated &&
      user?.email_verified &&
      user?.subscription_type &&
      (user?.is_questionnaire_completed ||
        !["PREMIUM", "GOLD"].includes(user?.subscription_type || ""))
    ) {
      targetRoute = "/(tabs)";
    }

    return {
      targetRoute,
      currentRoute,
      shouldNavigate: targetRoute !== null && targetRoute !== currentRoute,
    };
  }, [
    user?.email_verified,
    user?.subscription_type,
    user?.is_questionnaire_completed,
    user?.email,
    isAuthenticated,
    segments?.join("/") || "", // Stable string representation
  ]);
}

// Optimized navigation manager
function useNavigationManager(
  targetRoute: string | null,
  currentRoute: string,
  shouldNavigate: boolean,
  loaded: boolean
) {
  const router = useRouter();
  const lastNavigationRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    if (!loaded || !shouldNavigate || !targetRoute || isNavigatingRef.current) {
      return;
    }

    // Prevent duplicate navigations
    if (lastNavigationRef.current === targetRoute) {
      return;
    }

    // Immediate navigation without setTimeout to prevent delays
    isNavigatingRef.current = true;
    lastNavigationRef.current = targetRoute;

    router.replace(targetRoute as typeof router.replace extends (url: infer U, ...args: any) => any ? U : never);

    // Reset navigation flag after a short delay
    const resetTimeout = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 100);

    return () => {
      clearTimeout(resetTimeout);
    };
  }, [loaded, shouldNavigate, targetRoute, router]);
}

// Memoized loading screen component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>Loading...</Text>
  </View>
);

// Memoized stack screens to prevent re-creation
const StackScreens = () => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(auth)" />
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="payment-plan" />
    <Stack.Screen name="questionnaire" />
  </Stack>
);

// Fixed help content hook with proper memoization
function useHelpContent(): { title: string; description: string } | undefined {
  const segments = useSegments();

  return useMemo(() => {
    const route = "/" + segments.join("/");

    switch (route) {
      case "/(tabs)":
      case "/(tabs)/index":
        return {
          title: "Home Dashboard",
          description:
            "Welcome to your nutrition dashboard! Here you can view your daily progress, recent meals, and quick access to all features. Use the toolbar to switch languages or get help on any page.",
        };
      case "/(tabs)/calendar":
        return {
          title: "Calendar & Meal Planning",
          description:
            "Plan your meals for the week ahead. View scheduled meals, track your nutrition goals, and see your eating patterns over time. Tap any date to add or view planned meals.",
        };
      case "/(tabs)/statistics":
        return {
          title: "Nutrition Statistics",
          description:
            "Track your nutritional progress with detailed charts and metrics. Monitor your intake of macronutrients, micronutrients, and lifestyle factors. Use the time filters to view daily, weekly, or monthly trends.",
        };
      case "/(tabs)/camera":
        return {
          title: "Food Camera",
          description:
            "Take photos of your meals to automatically log nutrition information. The AI will analyze your food and provide detailed nutritional breakdown. Make sure to capture the entire meal for accurate results.",
        };
      case "/(tabs)/food-scanner":
        return {
          title: "Food Scanner",
          description:
            "Scan barcodes or upload food images to get instant nutrition information. Perfect for packaged foods and restaurant meals. The scanner works best with clear, well-lit images.",
        };
      case "/(tabs)/ai-chat":
        return {
          title: "AI Nutrition Assistant",
          description:
            "Chat with your personal AI nutrition assistant. Ask questions about food, get meal recommendations, and receive personalized advice based on your goals and dietary preferences.",
        };
      case "/(tabs)/recommended-menus":
        return {
          title: "Recommended Menus",
          description:
            "Discover personalized meal plans created just for you. Based on your dietary preferences, goals, and restrictions, these menus help you maintain a balanced and enjoyable diet.",
        };
      case "/(tabs)/history":
        return {
          title: "Meal History",
          description:
            "Review your past meals and track your eating patterns. Rate your meals, add notes, and learn from your nutrition journey. Use filters to find specific meals or time periods.",
        };
      case "/(tabs)/profile":
        return {
          title: "Profile & Settings",
          description:
            "Manage your personal information, dietary preferences, and app settings. Update your goals, allergies, and notification preferences to customize your experience.",
        };
      case "/(tabs)/devices":
        return {
          title: "Device Integration",
          description:
            "Connect your fitness trackers and health apps to get a complete picture of your wellness. Sync data from Apple Health, Google Fit, Fitbit, and other supported devices.",
        };
      case "/(tabs)/questionnaire":
        return {
          title: "Health Questionnaire",
          description:
            "Complete your health profile to receive personalized nutrition recommendations. This questionnaire helps us understand your goals, lifestyle, and dietary needs.",
        };
      default:
        return {
          title: "App Help",
          description:
            "Welcome to your nutrition tracking app! Use the navigation tabs to explore different features. Each page has specific help content available through this help button.",
        };
    }
  }, [segments]);
}

// Fixed AppContent component
const AppContent = () => {
  const authState = useSelector(selectAuthState);
  const questionnaireState = useSelector(
    (state: any) => state?.questionnaire || {}
  );

  const { isAuthenticated = false, user = null } = authState || {};
  const { questionnaire = null } = questionnaireState || {};

  useAppInitialization();

  // Font loading
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Memoized navigation state selector
  const segments = useSegments() as string[];

  // Memoized navigation state
  const navigationState = useNavigationState(user, isAuthenticated, segments);

  // Navigation management
  useNavigationManager(
    navigationState.targetRoute,
    navigationState.currentRoute,
    navigationState.shouldNavigate,
    loaded
  );

  // Splash screen handling
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      // Initialize notifications
      NotificationService.requestPermissions();
    }
  }, [loaded]);

  // Early return for loading state
  if (!loaded) {
    return null;
  }

  return <StackScreens />;
};

// Fixed main component with proper help content integration
const MainApp = () => {
  const helpContent = useHelpContent();

  return (
    <View style={styles.container}>
      <LanguageToolbar helpContent={helpContent} />
      <AppContent />
    </View>
  );
};

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <Provider store={store}>
            <QueryClientProvider client={queryClient}>
              <PersistGate loading={<LoadingScreen />} persistor={persistor}>
                <ThemeProvider>
                  <LanguageProvider>
                    <MainApp />
                    <StatusBar style="auto" />
                  </LanguageProvider>
                </ThemeProvider>
              </PersistGate>
            </QueryClientProvider>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
  },
});
