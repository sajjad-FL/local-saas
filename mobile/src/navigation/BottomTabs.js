import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useBiz } from '../context/BizContext';
import Icon from '../components/Icon';

// Screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import MembersScreen from '../screens/members/MembersScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import RoomsScreen from '../screens/rooms/RoomsScreen';
import SetupScreen from '../screens/setup/SetupScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

const Tab = createBottomTabNavigator();

function TabLabel({ title, focused, color }) {
  return (
    <View style={styles.labelWrapper}>
      <Text style={[styles.tabLabel, { color }]}>{title}</Text>
      {focused ? <View style={styles.tabPill} /> : <View style={styles.tabPillPlaceholder} />}
    </View>
  );
}

export default function BottomTabs() {
  const { theme, isDark } = useTheme();
  const { biz } = useBiz();

  const isHostel = biz?.type === 'hostel';
  const attendanceOn = biz?.attendanceEnabled !== false;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#0B0F19' : '#FFFFFF',
          borderTopColor: theme.colors.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 22 : 6,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.colors.tabActive,
        tabBarInactiveTintColor: theme.colors.tabInactive,
      }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Dashboard" focused={focused} color={color} />
          ),
          tabBarIcon: ({ color }) => (
            <Icon name="grid-outline" size={20} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Members"
        component={MembersScreen}
        options={{
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Members" focused={focused} color={color} />
          ),
          tabBarIcon: ({ color }) => (
            <Icon name="people-outline" size={21} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Reports" focused={focused} color={color} />
          ),
          tabBarIcon: ({ color }) => (
            <Icon name="bar-chart-outline" size={20} color={color} />
          ),
        }}
      />

      {/* Dynamic 4th tab */}
      {isHostel ? (
        <Tab.Screen
          name="RoomsTab"
          component={RoomsScreen}
          options={{
            tabBarLabel: ({ color, focused }) => (
              <TabLabel title="Rooms" focused={focused} color={color} />
            ),
            tabBarIcon: ({ color }) => (
              <Icon type="material" name="door-open" size={21} color={color} />
            ),
          }}
        />
      ) : attendanceOn ? (
        <Tab.Screen
          name="AttendanceTab"
          component={AttendanceScreen}
          options={{
            tabBarLabel: ({ color, focused }) => (
              <TabLabel title="Attendance" focused={focused} color={color} />
            ),
            tabBarIcon: ({ color }) => (
              <Icon name="calendar-outline" size={20} color={color} />
            ),
          }}
        />
      ) : (
        <Tab.Screen
          name="SetupTab"
          component={SetupScreen}
          options={{
            tabBarLabel: ({ color, focused }) => (
              <TabLabel title="Setup" focused={focused} color={color} />
            ),
            tabBarIcon: ({ color }) => (
              <Icon name="options-outline" size={20} color={color} />
            ),
          }}
        />
      )}

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Settings" focused={focused} color={color} />
          ),
          tabBarIcon: ({ color }) => (
            <Icon name="options-outline" size={20} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  labelWrapper: {
    alignItems: 'center',
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  tabPill: {
    width: 14,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#10B981',
    marginTop: 3,
  },
  tabPillPlaceholder: {
    width: 14,
    height: 2.5,
    marginTop: 3,
  },
});
