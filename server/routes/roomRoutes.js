import express from 'express'
import { getUserRooms, accessOrCreatePrivateChat, createGroupChat } from '../controllers/roomController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.route('/').get(protect, getUserRooms); 
router.route('/private').post(protect, accessOrCreatePrivateChat); 
router.route('/group').post(protect, createGroupChat); 

export default router