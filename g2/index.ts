import { createVisionoteActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'visionote',
  name: 'Visionote',
  pageTitle: 'Visionote',
  initialStatus: 'Visionote ready',
  createActions: createVisionoteActions,
}

export default app
