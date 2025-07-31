import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface NotificationSettings {
  pushNotifications: boolean;
  mealReminders: boolean;
  waterReminders: boolean;
  exerciseReminders: boolean;
  weeklyReports: boolean;
  goalAchievements: boolean;
}

const defaultSettings: NotificationSettings = {
  pushNotifications: true,
  mealReminders: true,
  waterReminders: true,
  exerciseReminders: false,
  weeklyReports: true,
  goalAchievements: true,
};

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10b981',
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  static async getSettings(): Promise<NotificationSettings> {
    try {
      const settings = await AsyncStorage.getItem('notification_settings');
      return settings ? JSON.parse(settings) : defaultSettings;
    } catch (error) {
      console.error('Error loading notification settings:', error);
      return defaultSettings;
    }
  }

  static async updateSettings(settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }

  static async scheduleWaterReminder(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.waterReminders) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💧 Time to Hydrate!',
        body: 'Remember to drink water and stay hydrated',
        data: { type: 'water_reminder' },
      },
      trigger: {
        seconds: 60 * 60 * 2, // Every 2 hours
        repeats: true,
      },
    });
  }

  static async scheduleMealReminder(mealType: string, time: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.mealReminders) return;

    const [hours, minutes] = time.split(':').map(Number);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🍽️ ${mealType} Time!`,
        body: `Don't forget to log your ${mealType.toLowerCase()}`,
        data: { type: 'meal_reminder', mealType },
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });
  }

  static async sendGoalAchievement(title: string, message: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.goalAchievements) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🎉 ${title}`,
        body: message,
        data: { type: 'achievement' },
      },
      trigger: null,
    });
  }

  static async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  static async cancelNotificationsByType(type: string): Promise<void> {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = notifications
      .filter(n => n.content.data?.type === type)
      .map(n => n.identifier);
    
    for (const id of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  }
}