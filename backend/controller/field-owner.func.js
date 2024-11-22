import mongoose from "mongoose"
import { Field } from "../models/field.model.js"
import { FieldOwner } from "../models/field-owner.model.js";

export const UploadField = async (req, res) => { 
    const {
        name, 
        address, 
        base_price, 
        image_url, 
        total_grounds, 
        description,
        operating_hours
    } = req.body;
    if (!(name && address && base_price && image_url && total_grounds && operating_hours?.length)) {
        return res.status(400).json({ 
            success: false, 
            message: "Please provide all required fields including operating hours" 
        });
    }

    try {
        const owner_id = req.user.id
        
        // Generate grounds array
        const grounds = Array.from({ length: total_grounds }, (_, index) => ({
            ground_number: index + 1,
            name: `Ground ${index + 1}`,
            status: true,
            size: '7', // Default size
            material: 'Grass', // Default material
            price_per_hour: base_price // Using base_price as default
        }));

        const NewField = new Field({
            owner_id,
            name,
            description,
            address,
            base_price,
            image_url,
            total_grounds,
            grounds,
            operating_hours
        });

        const fieldId = await NewField.save()
        await FieldOwner.findByIdAndUpdate(owner_id, { $push: { fields: fieldId._id}})

        return res.status(201).json({ success: true, message: "Field created successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "An error occurred", error: error.message });
    }
}


export const UploadService = async (req, res) => {
    const {fieldId, name, type, price} = req.body;
    if (!(fieldId || name || type || price)) {
        return res.status(400).json({ success: false, message: "Please provide all fields" });
    }
    
    try {
        const field = await Field.findById(fieldId)
        if (!field) {
            return res.status(404).json({ message: 'Field not found' });
        }
        field.services.push({name, type, price})
        await field.save()
        res.status(200).json({ message: 'Service added successfully', field });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

export const UpdateField = async (req, res) => {
    const { field_id } = req.params;
    const { name, description, address, base_price, image_url, total_grounds } = req.body;

    try {
        // Check if field exists and belongs to the owner
        const field = await Field.findOne({ 
            _id: field_id, 
            owner_id: req.user.id 
        });

        if (!field) {
            return res.status(404).json({ 
                success: false, 
                message: "Field not found or you don't have permission" 
            });
        }

        // Update field info
        const updatedField = await Field.findByIdAndUpdate(
            field_id,
            {
                $set: {
                    ...(name && { name }),
                    ...(description && { description }),
                    ...(address && { address }),
                    ...(base_price && { base_price }),
                    ...(image_url && { image_url }),
                    ...(total_grounds && { total_grounds })
                }
            },
            { new: true }
        );

        // Handle ground updates when total_grounds changes
        // if (total_grounds && total_grounds !== field.grounds.length) {
        //     if (total_grounds > field.grounds.length) {
        //         // Add new grounds
        //         const additionalGrounds = Array.from(
        //             { length: total_grounds - field.grounds.length }, 
        //             (_, index) => ({
        //                 ground_number: field.grounds.length + index + 1,
        //                 name: `Ground ${field.grounds.length + index + 1}`,
        //                 status: true,
        //                 size: '7',
        //                 material: 'Grass',
        //                 price_per_hour: base_price || field.base_price
        //             })
        //         );
        //         updatedField.grounds = [...field.grounds, ...additionalGrounds];
        //     } else {
        //         // Remove excess grounds
        //         // Only remove grounds that don't have active bookings
        //         const groundsToKeep = field.grounds.slice(0, total_grounds);
                
        //         // Verify no active bookings for grounds being removed
        //         const removedGrounds = field.grounds.slice(total_grounds);
        //         const hasActiveBookings = removedGrounds.some(ground => !ground.status);
                
        //         if (hasActiveBookings) {
        //             return res.status(400).json({
        //                 success: false,
        //                 message: "Cannot remove grounds with active bookings"
        //             });
        //         }
                
        //         updatedField.grounds = groundsToKeep;
        //     }
        //     await updatedField.save();
        // }

        return res.status(200).json({ 
            success: true, 
            message: "Field updated successfully",
            field: updatedField
        });

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "An error occurred", 
            error: error.message 
        });
    }
};

export const GetFields = async (req, res) => {
    try {
        console.log('Fetching fields for user ID:', req.user.id);
        
        // Find the field owner and populate the fields array
        const fieldOwner = await FieldOwner.findById(req.user.id)
            .populate({
                path: 'fields',
                // populate: {
                //     path: 'services' // If you want to populate services as well
                // }
            });

        if (!fieldOwner) {
            return res.status(404).json({
                success: false,
                message: "Field owner not found"
            });
        }

        console.log('Found fields:', fieldOwner.fields);
        
        return res.status(200).json({
            success: true,
            fields: fieldOwner.fields
        });
    } catch (error) {
        console.error('Get Fields Error:', error);
        return res.status(500).json({
            success: false,
            message: "Error fetching fields",
            error: error.message
        });
    }
};

