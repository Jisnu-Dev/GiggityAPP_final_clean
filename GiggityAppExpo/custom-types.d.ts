declare module 'expo-location' {
  export interface LocationObject {
    coords: {
      latitude: number;
      longitude: number;
      altitude?: number | null;
      accuracy?: number;
      altitudeAccuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
    };
    timestamp: number;
  }

  export enum Accuracy {
    Lowest = 1,
    Low = 2,
    Balanced = 3,
    High = 4,
    Highest = 5,
    BestForNavigation = 6
  }

  export enum ActivityType {
    Other = 1,
    AutomotiveNavigation = 2,
    Fitness = 3,
    OtherNavigation = 4
  }

  export function requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  export function requestBackgroundPermissionsAsync(): Promise<{ status: string }>;
  export function getCurrentPositionAsync(options: any): Promise<LocationObject>;
  export function watchPositionAsync(options: any, callback: (location: LocationObject) => void): Promise<{ remove: () => void }>;
  export function startLocationUpdatesAsync(taskName: string, options: any): Promise<void>;
  export function stopLocationUpdatesAsync(taskName: string): Promise<void>;
  export function enableNetworkProviderAsync(): Promise<void>;
}

declare module 'expo-notifications' {
  export interface AndroidNotificationPriority {
    MIN: 'min';
    LOW: 'low';
    DEFAULT: 'default';
    HIGH: 'high';
    MAX: 'max';
  }
  
  export const AndroidNotificationPriority: AndroidNotificationPriority;
  
  export function setNotificationHandler(handler: { handleNotification: () => Promise<any> }): void;
  export function scheduleNotificationAsync(options: any): Promise<string>;
  export function requestPermissionsAsync(options?: any): Promise<{ status: string }>;
}

declare module 'expo-task-manager' {
  export function defineTask(taskName: string, callback: (data: any) => void): void;
}

declare module 'expo-constants' {
  export const appOwnership: string | null;
}

// React hook and component declarations
declare module 'react' {
  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useRef<T>(initialValue: T): { current: T };
  
  export type FC<P = {}> = FunctionComponent<P>;
  export type FunctionComponent<P = {}> = (props: P) => React.ReactElement | null;
  export type PropsWithChildren<P = {}> = P & { children?: React.ReactNode };
  export type ReactElement = any;
  export type ReactNode = any;
  export type ComponentProps<T> = T extends React.ComponentType<infer P> ? P : never;
  
  export class Component<P = {}, S = {}> {
    constructor(props: P, context?: any);
    setState<K extends keyof S>(
      state: ((prevState: Readonly<S>, props: Readonly<P>) => (Pick<S, K> | S | null)) | (Pick<S, K> | S | null),
      callback?: () => void
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): ReactNode;
    readonly props: Readonly<P>;
    state: Readonly<S>;
    context: any;
  }
}

// React Native component declarations
declare module 'react-native' {
  export class View extends React.Component<any> {}
  export class Text extends React.Component<any> {}
  export class ScrollView extends React.Component<any> {}
  export class TextInput extends React.Component<any> {}
  export class Image extends React.Component<any> {}
  export class Button extends React.Component<any> {}
  export class Modal extends React.Component<any> {}
  export class ActivityIndicator extends React.Component<any> {}
  export class Animated {
    static View: typeof View;
    static Value: new (value: number) => any;
    static timing: (value: any, config: any) => { start: (callback?: () => void) => void };
    static spring: (value: any, config: any) => { start: (callback?: () => void) => void };
    static sequence: (animations: any[]) => { start: (callback?: () => void) => void };
    static loop: (animation: any, config?: any) => { start: (callback?: () => void) => void };
  }
  export class StyleSheet {
    static create<T extends {[key: string]: any}>(styles: T): T;
    static absoluteFill: any;
    static absoluteFillObject: any;
  }
  export class FlatList<T = any> extends React.Component<any> {
    scrollToEnd: (params?: { animated?: boolean }) => void;
  }
  export type StyleProp<T> = T;
  export type OpaqueColorValue = any;
}

// Expo Blur component
declare module 'expo-blur' {
  export class BlurView extends React.Component<any> {}
} 