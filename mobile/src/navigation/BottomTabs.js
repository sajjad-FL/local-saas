import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useBiz } from '../context/BizContext';
import Icon from '../components/Icon';
import { words } from '../constants/wording';

// Screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import MembersScreen from '../screens/members/MembersScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import RoomsScreen from '../screens/rooms/RoomsScreen';
import SetupScreen from '../screens/setup/SetupScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import EnquiriesScreen from '../screens/enquiries/EnquiriesScreen';

const Tab = createBottomTabNavigator();

function TabLabel({ title, focused, color }) {
  return (
    <View style={styles.labelWrapper}>
      {/* six tabs on a narrow phone: shrink a long name to fit instead of cutting it off */}
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} allowFontScaling={false}>{title}</Text>
      {focused ? <View style={styles.tabPill} /> : <View style={styles.tabPillPlaceholder} />}
    </View>
  );
}

export default function BottomTabs() {
  const { theme, isDark } = useTheme();
  const { biz } = useBiz();

  const isHostel = biz?.type === 'hostel';
  const attendanceOn = biz?.attendanceEnabled !== false;
  // the same names as the web's menu: Members (or Tenants, Students…), Money
  const member = words(biz?.type).member || 'member';
  const membersLabel = member === 'member' ? 'Members' : `${member[0].toUpperCase()}${member.slice(1)}s`;
  // sit above the phone's gesture bar or buttons (Android draws edge to edge)
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#0B0F19' : '#FFFFFF',
          borderTopColor: theme.colors.tabBarBorder,
          borderTopWidth: 1,
          height: 60 + bottom,
          paddingBottom: bottom,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.colors.tabActive,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarItemStyle: { paddingHorizontal: 0 }, // six names have to fit across a small phone
      }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Home" focused={focused} color={color} />
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
            <TabLabel title={membersLabel} focused={focused} color={color} />
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
            <TabLabel title="Money" focused={focused} color={color} />
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
        name="Enquiries"
        component={EnquiriesScreen}
        options={{
          tabBarLabel: ({ color, focused }) => (
            <TabLabel title="Enquiries" focused={focused} color={color} />
          ),
          tabBarIcon: ({ color }) => (
            <Icon name="person-add-outline" size={20} color={color} />
          ),
        }}
      />

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
    alignSelf: 'stretch',
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  tabPill: {
    width: 14,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#5B3DF5',
    marginTop: 3,
  },
  tabPillPlaceholder: {
    width: 14,
    height: 2.5,
    marginTop: 3,
  },
});
