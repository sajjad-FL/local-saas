import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Loader from '../components/Loader';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useBiz } from '../context/BizContext';

// Navigators & Screens
import BottomTabs from './BottomTabs';
import LoginScreen from '../screens/auth/LoginScreen';
import MemberDetailScreen from '../screens/members/MemberDetailScreen';
import StatementScreen from '../screens/statement/StatementScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import RoomsScreen from '../screens/rooms/RoomsScreen';
import SetupScreen from '../screens/setup/SetupScreen';
import SalesScreen from '../screens/sales/SalesScreen';
import { NoBusinessScreen, PausedBusinessScreen } from '../screens/onboarding/NoBusinessScreen';

const Stack = createNativeStackNavigator();

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'localsaas://', 'https://app.example.com'],
  config: {
    screens: {
      Statement: 's/:token',
      Main: {
        screens: {
          Dashboard: '',
          Members: 'members',
          Reports: 'reports',
          RoomsTab: 'rooms-tab',
          AttendanceTab: 'attendance-tab',
          SetupTab: 'setup-tab',
          Enquiries: 'enquiries',
          Settings: 'settings',
        },
      },
      MemberDetail: 'members/:id',
      Attendance: 'attendance',
      Rooms: 'rooms',
      Setup: 'setup',
      Sales: 'sales',
    },
  },
};

export default function AppNavigator() {
  const { token, isLoading } = useAuth();
  const { biz, businesses, loaded } = useBiz();
  const noBusiness = loaded && businesses.length === 0;
  const paused = biz?.status === 'suspended';
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Loader page label="Starting LocalSaaS" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // pages opened on top of the tabs keep clear of the gesture bar; the tabs handle their own
          contentStyle: { backgroundColor: theme.colors.background, paddingBottom: insets.bottom },
          animation: 'slide_from_right',
        }}>
        {!token ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : noBusiness ? (
          <Stack.Screen name="NoBusiness" component={NoBusinessScreen} />
        ) : paused ? (
          <Stack.Screen name="Paused" component={PausedBusinessScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={BottomTabs} options={{ contentStyle: { backgroundColor: theme.colors.background, paddingBottom: 0 } }} />
            <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="Rooms" component={RoomsScreen} />
            <Stack.Screen name="Setup" component={SetupScreen} />
            <Stack.Screen name="Sales" component={SalesScreen} />
          </>
        )}
        {/* Public statement screen can be viewed anytime via deep link or token */}
        <Stack.Screen name="Statement" component={StatementScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
