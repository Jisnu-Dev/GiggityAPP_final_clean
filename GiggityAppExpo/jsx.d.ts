import 'react-native';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'View': any;
      'Text': any;
      'TextInput': any;
      'ScrollView': any;
      'Button': any;
      'Modal': any;
      'Image': any;
      'ActivityIndicator': any;
      'BlurView': any;
      'FlatList': any;
      'TouchableOpacity': any;
      'Animated.View': any;
      'KeyboardAvoidingView': any;
      'Pressable': any;
    }
  }
}

// Fix for ViewStyle and other types
type ViewStyle = any;
type TextStyle = any;
type StyleProp<T> = T;
type OpaqueColorValue = any;

// Fix for react-native components that TypeScript can't find
declare module 'react-native' {
  export class FlatList<T = any> extends React.Component<any> {
    scrollToEnd: (params?: { animated?: boolean }) => void;
  }
  export class KeyboardAvoidingView extends React.Component<any> {}
  export class Pressable extends React.Component<any> {}
  export class Animated {
    static View: any;
    static Value: new (value: number) => any;
    static timing: (value: any, config: any) => { start: (callback?: () => void) => void };
    static spring: (value: any, config: any) => { start: (callback?: () => void) => void };
    static sequence: (animations: any[]) => { start: (callback?: () => void) => void };
    static loop: (animation: any, config?: any) => { start: (callback?: () => void) => void };
  }

  export const TouchableOpacity: any;
  export const Alert: any;
  export const Vibration: any;
  export const AppState: any;
  export const Platform: any;
  export const Dimensions: any;
  export const useColorScheme: () => string | null;
  
  export const StyleSheet: {
    create: <T extends object>(styles: T) => T;
    absoluteFill: any;
    absoluteFillObject: any;
  };
  
  // Override TextStyle and ViewStyle types
  export interface TextStyle {
    color?: string;
    fontSize?: number;
    fontWeight?: string;
    lineHeight?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    textAlign?: string;
    flex?: number;
    padding?: number;
    maxWidth?: number;
    textDecorationLine?: string;
    [key: string]: any;
  }
  
  export interface ViewStyle {
    flex?: number;
    padding?: number;
    margin?: number;
    width?: number;
    height?: number;
    backgroundColor?: string;
    borderRadius?: number;
    alignItems?: string;
    justifyContent?: string;
    position?: string;
    transform?: any[];
    [key: string]: any;
  }
  
  // Add TextProps with numberOfLines
  export interface TextProps {
    numberOfLines?: number;
    ellipsizeMode?: string;
    style?: StyleProp<TextStyle>;
  }
  
  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
  }
}

// Fix for bottom tab navigation props
declare module '@react-navigation/bottom-tabs' {
  export interface BottomTabBarButtonProps {
    onPressIn?: (e: any) => void;
  }
}

// Fix for Ionicons and MaterialIcons
declare module '@expo/vector-icons' {
  export const Ionicons: React.ComponentClass<any>;
  export const MaterialIcons: React.ComponentClass<any>;
}

// Fix for expo-router Link props
declare module 'expo-router' {
  export interface LinkProps {
    href: any;
    style?: any;
  }
}