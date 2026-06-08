import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

const native = () => Capacitor.isNativePlatform();

export const hapticLight   = () => native() && Haptics.impact({ style: ImpactStyle.Light });
export const hapticMedium  = () => native() && Haptics.impact({ style: ImpactStyle.Medium });
export const hapticHeavy   = () => native() && Haptics.impact({ style: ImpactStyle.Heavy });
export const hapticSuccess = () => native() && Haptics.notification({ type: NotificationType.Success });
export const hapticWarning = () => native() && Haptics.notification({ type: NotificationType.Warning });
export const hapticError   = () => native() && Haptics.notification({ type: NotificationType.Error });
export const hapticSelect  = () => native() && Haptics.selectionChanged();
