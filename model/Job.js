const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const jobSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    segments: { type: Number, required: true },
    segment_1: { type: String },
    segment_2: { type: String },
    segment_3: { type: String },
    segment_4: { type: String },
    segment_5: { type: String },
    segment_6: { type: String },
    segment_7: { type: String },
    segment_8: { type: String },
    segment_9: { type: String },
    segment_10: { type: String },
    const_inp_file: { type: String },
    data_file: { type: String, required: true },
    conformational_sampling: {
        type: Number,
        enum: [200, 400, 600, 800],
        default: 200
    },
    rg_min: { type: Number, reqired: true, minimum: 10, maximum: 100 },
    rg_max: { type: Number, reqired: true, minimum: 10, maximum: 100 },
    status: {
        type: String,
        enum: ['Submitted', 'Pending', 'Running', 'Completed', 'Error'],
        default: 'Submitted'
    },
    time_submitted: Date
});

module.exports = mongoose.model('Job', jobSchema);
