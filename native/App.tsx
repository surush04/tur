import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import { I18nProvider, useI18n } from './src/i18n';
import { colors } from './src/theme';
import { EditProfileScreen, HelpScreen, LanguageScreen, NotificationsScreen, ProfileScreen, SettingsScreen } from './src/screens/account';
import { DestinationScreen, ExploreScreen, GuideScreen, GuidesScreen, SearchScreen, StayScreen, StaysScreen } from './src/screens/browse';
import { CompanionsScreen, FavoritesScreen, PlannerScreen, TripsScreen } from './src/screens/extra';
import { ForgotScreen, LoginScreen, OnboardingScreen, RegisterScreen, SplashScreen } from './src/screens/gate';
import { HomeScreen } from './src/screens/home';
import { OwnerScreen, OwnerTourScreen, ReelNewScreen } from './src/screens/owner';
import { ConversationScreen, GroupNewScreen, GroupScreen, GroupsScreen, MessagesScreen, ReelsScreen } from './src/screens/social';
import { BookingScreen, TourScreen, TripScreen } from './src/screens/tour';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 60 },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home-outline',
            Reels: 'film-outline',
            Explore: 'compass-outline',
            Groups: 'people-outline',
            Favorites: 'bookmark-outline',
            Profile: 'person-outline',
          };
          return <Ionicons name={icons[route.name] ?? 'ellipse-outline'} color={color} size={size} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="Reels" component={ReelsScreen} options={{ title: t('tabs.reels') }} />
      <Tabs.Screen name="Explore" component={ExploreScreen} options={{ title: t('tabs.explore') }} />
      {user ? <Tabs.Screen name="Groups" component={GroupsScreen} options={{ title: t('tabs.groups') }} /> : null}
      <Tabs.Screen name="Favorites" component={FavoritesScreen} options={{ title: t('tabs.favorites') }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile') }} />
    </Tabs.Navigator>
  );
}

function Root() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Forgot" component={ForgotScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Tour" component={TourScreen} />
      <Stack.Screen name="Destination" component={DestinationScreen} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="Trip" component={TripScreen} />
      <Stack.Screen name="Group" component={GroupScreen} />
      <Stack.Screen name="GroupNew" component={GroupNewScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Stay" component={StayScreen} />
      <Stack.Screen name="Stays" component={StaysScreen} />
      <Stack.Screen name="Guide" component={GuideScreen} />
      <Stack.Screen name="Guides" component={GuidesScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="Owner" component={OwnerScreen} />
      <Stack.Screen name="OwnerTour" component={OwnerTourScreen} />
      <Stack.Screen name="ReelNew" component={ReelNewScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Trips" component={TripsScreen} />
      <Stack.Screen name="Companions" component={CompanionsScreen} />
      <Stack.Screen name="Planner" component={PlannerScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <Root />
          </NavigationContainer>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
