import { Customer } from "../models/customer.model.js";
import jwt from "jsonwebtoken";
import { Booking } from "../models/booking.model.js";
import { Field } from "../models/field.model.js";
import { Notification } from '../models/notification.model.js';
import { Rating } from "../models/rating.model.js";

// Helper function to check if a time slot is currently available
const isTimeSlotAvailable = (ground, startTime) => {
    const currentTime = new Date();
    const startDateTime = new Date(startTime);
    const currentTimestamp = Date.now(); // Get current time in milliseconds
    const startTimestamp = new Date(startTime).getTime(); // Convert start time to milliseconds
    // console.log('Start timestamp:', startTimestamp);
    // console.log('Current timestamp:', currentTimestamp);

    // Check if the start time is in the past
    if (startTimestamp < currentTimestamp) {
        return false; // Cannot book in the past
    }

    // Check if the slot overlaps with any occupied slots
    return !ground.occupied_slots.some(slot => {
        const slotStartDateTime = new Date(slot.start_time);
        // Check for overlap
        return startDateTime.getTime() === slotStartDateTime.getTime();

    });
};

export const makeBooking = async (req, res) => {
    const { field_id, ground_id, start_time, end_time, price, services, booking_date } = req.body;

    if (!(field_id && ground_id && start_time && end_time && booking_date)) {
        return res.status(400).json({ success: false, message: "Please provide all fields" });
    }

    try {
        const field = await Field.findById(field_id);
        if (!field) {
            return res.status(404).json({ success: false, message: "Field not found" });
        }

        const ground = field.grounds.id(ground_id);
        if (!ground) {
            return res.status(404).json({ success: false, message: "Ground not found" });
        }

        // Check if the time slot is available
        if (!isTimeSlotAvailable(ground, start_time)) {
            return res.status(400).json({
                success: false,
                message: "This time slot is not available. You are either booking in the past or the slot is already occupied."
            });
        }

        const customer_id = req.user.id;
        // Create the booking
        const booking = await Booking.create({
            customer_id,
            field_id,
            ground_id,
            start_time,
            end_time,
            price,
            services
        });

        await field.save();

        res.status(200).json({
            success: true,
            message: 'Booking created successfully',
            bookingId: booking._id,
            start_time: start_time,
            end_time: end_time
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

export const getBookings = async (req, res) => {
    const customer_id = req.user.id
    const bookings = await Booking.find({ customer_id });
    res.status(200).json({ bookings });
}

export const getRecommendedFields = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        const fields = await Field.find()
            .populate('owner_id', 'fullname email')
            .limit(limit);
        res.status(200).json({ success: true, fields });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching fields', error: error.message });
    }
}

export const SearchFields = async (req, res) => {
    try {
        const searchTerm = req.query.q;
        const fields = await Field.find({
            name: {
                $regex: searchTerm,
                $options: 'i'
            }
        });

        res.status(200).json({
            success: true,
            fields
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error searching fields',
            error: error.message
        });
    }
}

export const sendNotification = async (req, res) => {
    const { recipient_id, message, booking_id, type } = req.body;
    const notification = await Notification.create({
        ownerId: recipient_id,
        message: message,
        bookingId: booking_id,
        type: type
    });
    res.status(200).json({ success: true, notification });
}

export const getResponseNoti = async (req, res) => {
    try {
        // 1. Get the field owner's ID from the authenticated request
        const customerId = req.user.id;

        const notifications = await Notification.find({
            customerId: customerId
        })
            .populate({
                path: 'bookingId',
                select: 'field_id booking_time status',
                populate: {
                    path: 'field_id',
                    select: 'name address'
                }
            })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            notifications: notifications.map(notification => ({
                id: notification._id,
                message: notification.message,
                bookingDetails: notification.bookingId,
                createdAt: notification.createdAt,
                isRead: notification.isRead,
                type: notification.type
            }))
        });

    } catch (error) {
        console.error('Error fetching customer notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications',
            error: error.message
        });
    }
};

export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const customerId = req.user.id;

        await Notification.updateMany(
            { customerId: customerId }, 
            { $set: { isRead: true } }
        );

        res.status(200).json({ 
            success: true, 
            message: 'All notifications marked as read' 
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error marking notifications as read', 
            error: error.message 
        });
    }
};

// Function to search fields by name or location
export const HPsearchFields = async (req, res) => {
    try {
        const { name, address } = req.query;

        // Build the query object
        const query = {};
        if (name) {
            query.name = { $regex: name, $options: 'i' }; // Case-insensitive search
        }
        if (address) {
            query.address = { $regex: address, $options: 'i' }; // Case-insensitive search
        }

        // Find fields matching the query
        const fields = await Field.find(query);
        res.status(200).json({ success: true, fields });
    } catch (error) {
        console.error('Error searching fields:', error);
        res.status(500).json({ success: false, message: 'Error searching fields', error: error.message });
    }
};

export const submitRating = async (req, res) => {
    const { rating, comment, field_id } = req.body;
    const customer_id = req.user.id;

    try {
        const newRating = new Rating({
            customer_id,
            field_id,
            stars: rating,
            comment,
        });

        await newRating.save();

        res.status(201).json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error submitting rating', error: error.message });
    }
};

export const getFieldRatings = async (req, res) => {
    const { fieldId } = req.params;

    try {
        const ratings = await Rating.find({ field_id: fieldId }).populate('customer_id');

        res.status(200).json({ success: true, ratings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching ratings', error: error.message });
    }
};
