import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './OrderField.css';
import { RatingSection } from './RatingSection';
import { CommentsSection } from './CommentsSection';
import DateSelector from './DateSelector';
import { ServiceSelectionBoard } from './ServiceSelectionBoard';

export const OrderField = () => {
  const location = useLocation();
  const field = location.state?.field;
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedGround, setSelectedGround] = useState('');
  const [selectedHours, setSelectedHours] = useState({ start: '', end: '' });
  const [serviceQuantities, setServiceQuantities] = useState({});
  // const [showServicesList, setShowServicesList] = useState(false);
  const [showServiceBoard, setShowServiceBoard] = useState(false);
  const navigate = useNavigate();
  const [occupiedSlots, setOccupiedSlots] = useState([]);

  const handleDateSelect = (date) => {
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];
    setSelectedDate(localDate);
  };

  // Reset hours when ground changes
  useEffect(() => {
    setSelectedHours({ start: '', end: '' });
  }, [selectedGround]);

  const handleQuantityChange = (serviceId, change) => {
    setServiceQuantities(prev => ({
      ...prev,
      [serviceId]: Math.max(0, (prev[serviceId] || 0) + change)
    }));
  };

  const handleSendNotification = async (bookingId) => {
    try {
      const notificationData = {
        recipient_id: field.owner_id,
        message: `New booking request for ${field.name}`,
        booking_id: bookingId,
        type: 'request'
      };

      const response = await fetch('http://localhost:5000/api/customer/send_notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(notificationData)
      });

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedDate || !selectedGround || !selectedHours.start || !selectedHours.end) {
      alert('Please fill in all required fields.');
      return;
    }

    const totalGroundPrice = (field.base_price || 0);
    const totalServicePrice = Object.entries(serviceQuantities).reduce((total, [serviceId, quantity]) => {
      const service = field.services.find(s => s._id === serviceId);
      return total + (service?.price * quantity || 0);
    }, 0);

    const totalPrice = totalGroundPrice + totalServicePrice;
    const bookingData = {
      field_id: field._id,
      ground_id: selectedGround,
      start_time: new Date(`${selectedDate}T${selectedHours.start}:00`),
      end_time: new Date(`${selectedDate}T${selectedHours.end}:00`),
      services: Object.entries(serviceQuantities).map(([serviceId, quantity]) => {
        const service = field.services.find(s => s._id === serviceId);
        return {
          service_id: serviceId,
          name: service?.name,
          price: service?.price,
          quantity: quantity
        };
      }).filter(service => service.quantity > 0),
      booking_date: selectedDate,
      price: totalPrice
    };
    bookingData.price = totalPrice;

    try {
      const response = await fetch("http://localhost:5000/api/customer/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(bookingData)
      });

      const data = await response.json();

      if (response.ok) {
        await handleSendNotification(data.bookingId);
        navigate(`/order-confirmation`, { state: { message: data.message } });
      } else {
        alert(data.message || 'Failed to place order');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error placing order');
    }
  };

  const handleAddService = (service) => {
    setServiceQuantities(prev => ({
      ...prev,
      [service._id]: (prev[service._id] || 0) + 1
    }));
    setShowServiceBoard(false);
  };

  const handleRemoveService = (serviceId) => {
    setServiceQuantities(prev => {
      const newQuantities = { ...prev };
      delete newQuantities[serviceId];
      return newQuantities;
    });
  };

  // Update occupied slots when ground or date changes
  useEffect(() => {
    if (selectedGround && selectedDate) {
      const ground = field.grounds.find(g => g._id === selectedGround);
      if (ground) {
        // Filter occupied slots for the selected date
        const dateOccupiedSlots = ground.occupied_slots.filter(slot => {
          const slotDate = new Date(slot.start_time).toISOString().split('T')[0];
          // console.log(slotDate, selectedDate);
          return slotDate === selectedDate;
        });
        setOccupiedSlots(dateOccupiedSlots);
      }
    } else {
      setOccupiedSlots([]);
    }
  }, [selectedGround, selectedDate, field.grounds]);

  // Helper function to check if a time slot is occupied
  const isTimeSlotOccupied = (startTime, endTime) => {
    return occupiedSlots.some(slot => {
      const slotStart = new Date(slot.start_time).toLocaleTimeString('vi-VN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      const slotEnd = new Date(slot.end_time).toLocaleTimeString('vi-VN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      return startTime === slotStart || endTime === slotEnd ||
        (startTime > slotStart && startTime < slotEnd) ||
        (endTime > slotStart && endTime < slotEnd);
    });
  };

  if (!field) return <div>Loading...</div>;

  return (
    <div className="order-page-container">
      {/* Top section with field info and image */}
      <div className="field-description-plate">
        <div className="field-description-content">
          <h1 className="field-name">{field.name}</h1>
          <div className="field-info">
            <p className="field-address">
              <span className="label">Address:</span>
              {field.address}
            </p>
            <p className="field-owner">
              <span className="label">Owner:</span>
              {field.owner_id.fullname}
            </p>
            {/* <p className="field-description">
                            <span className="label">Description:</span>
                            {field.description}
                        </p> */}
            <p className="field-hours">
              <span className="label">Operating Hours:</span>
              {field.operating_hours.map((hours, index) => (
                <span key={index}>
                  {hours.start_hour}:00 - {hours.end_hour}:00
                  {index < field.operating_hours.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
            <p className="field-grounds">
              <span className="label">Available Grounds:</span>
              {field.total_grounds}
            </p>
          </div>
          <div className="base-price-box">
            <span className="price-label">BASE PRICE</span>
            <span className="price-amount">{field.base_price} VNĐ</span>
          </div>
        </div>
        <div className="field-image-container">
          {field.image_url ? (
            <img src={field.image_url[0]} alt={field.name} />
          ) : (
            <div className="placeholder-image"></div>
          )}
        </div>
      </div>

      {/* Bottom section with future-purpose plate and order form */}
      <div className="bottom-section-container">
        {/* Left plate for future purposes */}
        <div className="future-purpose-plate">
          <RatingSection />
          <CommentsSection fieldId={field._id} />
        </div>

        {/* Right side - Order form */}
        <div className="order-form-section">
          <div className="booking-time-section">
            <h2>Choose Booking Details</h2>

            {/* Ground Selection */}
            <div className="ground-selection">
              <label>Select Ground:</label>
              <select
                value={selectedGround}
                onChange={(e) => setSelectedGround(e.target.value)}
                className="ground-select"
              >
                <option value="">Choose a ground...</option>
                {field.grounds.map(ground => (
                  <option key={ground._id} value={ground._id}>
                    {ground.name} - Sân {ground.size} người
                  </option>
                ))}
              </select>
            </div>

            {/* Date and Time Selection - Always visible but conditionally disabled */}
            <div className="date-selection">
              <label>Select Date:</label>
              <DateSelector
                onDateSelect={handleDateSelect}
                onChange={(e) => setSelectedDate(e.target.value)} />
            </div>

            <div className="hours-selection">
              <label>Select Time Range:</label>
              <div className="time-slots-container">
                {!selectedGround || !selectedDate ? (
                  <div className="empty-time-slots">Chưa chọn sân và ngày</div>
                ) : (
                  <div className="time-slots-grid">
                    {selectedDate && field.service_times
                      .find(schedule => schedule.day_of_week === new Date(selectedDate).getDay())
                      ?.time_slots
                      .map((slot, index) => {
                        const isOccupied = isTimeSlotOccupied(slot.start_time, slot.end_time);
                        return (
                          <div
                            key={index}
                            className={`time-slot ${isOccupied ? 'occupied' : 'vacant'} ${
                              selectedHours.start === slot.start_time ? 'selected' : ''
                            }`}
                            onClick={() => {
                              if (!isOccupied) {
                                setSelectedHours({
                                  start: slot.start_time,
                                  end: slot.end_time
                                });
                              }
                            }}
                          >
                            <div className="status-indicator"></div>
                            <div className="time-display">
                              <span className="start-time">{slot.start_time}</span>
                              <span className="end-time">{slot.end_time}</span>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Services Selection */}
          <div className="services-section">
            <h2>Additional Services</h2>
            
            {/* Selected Services List */}
            {Object.keys(serviceQuantities).length > 0 && (
              <div className="selected-services-list">
                {field.services
                  .filter(service => serviceQuantities[service._id] > 0)
                  .map(service => (
                    <div key={service._id} className="selected-service-item">
                      <div className="service-info">
                        <div className="service-header">
                          <h3>{service.name}</h3>
                          <button 
                            className="remove-service-btn"
                            onClick={() => handleRemoveService(service._id)}
                          >
                            ×
                          </button>
                        </div>
                        <p className="service-price">{service.price} VNĐ</p>
                      </div>
                      <div className="quantity-controls">
                        <button
                          onClick={() => handleQuantityChange(service._id, -1)}
                          className="quantity-btn"
                        >
                          -
                        </button>
                        <span className="quantity-display">
                          {serviceQuantities[service._id] || 0}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(service._id, 1)}
                          className="quantity-btn"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Add Service Button - Always visible */}
            <button 
              className="add-service-btn"
              onClick={() => setShowServiceBoard(true)}
            >
              + Thêm dịch vụ
            </button>

            {/* Service Selection Board */}
            {showServiceBoard && (
              <ServiceSelectionBoard
                services={field.services}
                onAddService={handleAddService}
                onClose={() => setShowServiceBoard(false)}
              />
            )}
          </div>

          {/* New Order Summary Box */}
          <div className="order-summary-box">
            <h2>Order Summary</h2>

            {/* Field Base Price */}
            <div className="summary-item">
              <div className="summary-label">Field Price:</div>
              <div className="summary-price">{field.base_price || 0} VNĐ</div>
            </div>

            {/* Ground Selection Info (without price) */}
            {selectedGround && (
              <div className="summary-item">
                <div className="summary-label">Selected Ground:</div>
                <div className="summary-details">
                  <div>{field.grounds.find(g => g._id === selectedGround)?.name}</div>
                </div>
              </div>
            )}

            {/* Services Summary */}
            {Object.entries(serviceQuantities).map(([serviceId, quantity]) => {
              if (quantity > 0) {
                const service = field.services.find(s => s._id === serviceId);
                return (
                  <div key={serviceId} className="summary-item">
                    <div className="summary-label">
                      {service?.name} x{quantity}:
                    </div>
                    <div className="summary-price">
                      {(service?.price * quantity)} VNĐ
                    </div>
                  </div>
                );
              }
              return null;
            })}

            {/* Update Total Calculation */}
            <div className="total-section">
              <div className="total-label">Total Amount:</div>
              <div className="total-amount">
                {(
                  (field.base_price || 0) +
                  Object.entries(serviceQuantities).reduce((total, [serviceId, quantity]) => {
                    const service = field.services.find(s => s._id === serviceId);
                    return total + (service?.price * quantity || 0);
                  }, 0)
                )} VNĐ
              </div>
            </div>
          </div>

          {/* Place Order Button */}
          <button
            className="submit-order-btn"
            onClick={handlePlaceOrder}>
            Place Order
          </button>
        </div>
      </div>
    </div>
  );
};