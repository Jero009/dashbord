import { toastController } from '@ionic/vue';

export type ToastColor = 'danger' | 'success' | 'warning';

// One toast helper for all pages so duration/position stay consistent.
// `color` follows the app convention: 'danger' for failures (default),
// 'warning' for cautions, 'success' for confirmations.
export async function showToast(
  message: string,
  color: ToastColor = 'danger',
  duration = 2000
): Promise<void> {
  const toast = await toastController.create({ message, duration, color });
  await toast.present();
}
