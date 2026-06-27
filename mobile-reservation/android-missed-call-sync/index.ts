import { registerRootComponent } from 'expo';

import App from './App';
// Registers the notifee foreground-service runner before the UI mounts so the
// persistent "Syncing missed calls" notification can host the sync loop.
import './src/sync/foregroundService';

registerRootComponent(App);
