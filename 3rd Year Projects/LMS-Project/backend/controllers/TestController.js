const Test = require('../models/Test.js');
const TestAttempt = require('../models/TestAttempt.js'); // Humne iska naam Result se TestAttempt kar diya hai
const asyncHandler = require('../middleware/asyncHandler.js');
const mongoose = require('mongoose');

// @desc    Get all tests
// @route   GET /api/tests
// @access  Private/Admin
const getAllTests = asyncHandler(async (req, res) => {
    const tests = await Test.find({}).populate('course', 'title').populate('branch', 'name').sort({ createdAt: -1 });
    res.status(200).json(tests);
});

// @desc    Get a single test by its ID (SAFE VERSION for students)
// @route   GET /api/tests/:id
// @access  Private
const getTestById = asyncHandler(async (req, res) => {
    const test = await Test.findById(req.params.id).select('-questions.correctOption');
    if (test) {
        res.status(200).json(test);
    } else {
        res.status(404);
        throw new Error('Test not found with this ID');
    }
});

// @desc    Get all tests for a specific course
// @route   GET /api/tests/course/:courseId
// @access  Private
const getTestsForCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(200).json([]);
    }
    const tests = await Test.find({ course: courseId }).select('title description');
    res.status(200).json(tests);
});

// @desc    Create a new test
// @route   POST /api/tests
// @access  Private/Admin
const createTest = asyncHandler(async (req, res) => {
    const { title, course, branch, duration, questions, isProctored } = req.body;

    if (!title || !course || !branch || !questions || questions.length === 0) {
        res.status(400);
        throw new Error('Please provide title, course, branch, and at least one question');
    }

    const transformedQuestions = questions.map(q => {
        if (q.correctOption === undefined || !q.options || !Array.isArray(q.options)) {
            throw new Error('Each question must have options and a correct answer index.');
        }
        return {
            questionText: q.questionText,
            options: q.options,
            correctOption: q.correctOption
        };
    });

    const test = new Test({
        title,
        course,
        branch,
        duration,
        isProctored,
        questions: transformedQuestions,
        createdBy: req.user._id,
    });

    const createdTest = await test.save();
    res.status(201).json(createdTest);
});


// @desc    Update an existing test
// @route   PUT /api/tests/:id
// @access  Private/Admin
const updateTest = asyncHandler(async (req, res) => {
    const test = await Test.findById(req.params.id);

    if (test) {
        test.title = req.body.title || test.title;
        test.course = req.body.course || test.course;
        test.branch = req.body.branch || test.branch;
        test.questions = req.body.questions || test.questions;
        test.duration = req.body.duration || test.duration;
        test.isProctored = req.body.isProctored !== undefined ? req.body.isProctored : test.isProctored;

        const updatedTest = await test.save();
        res.status(200).json(updatedTest);
    } else {
        res.status(404);
        throw new Error('Test not found');
    }
});

// @desc    Delete a test
// @route   DELETE /api/tests/:id
// @access  Private/Admin
const deleteTest = asyncHandler(async (req, res) => {
    const test = await Test.findById(req.params.id);
    if (test) {
        await test.deleteOne();
        await TestAttempt.deleteMany({ test: req.params.id });
        res.status(200).json({ message: 'Test and all associated results removed successfully' });
    } else {
        res.status(404);
        throw new Error('Test not found');
    }
});

// @desc    Submit a test and save the result
// @route   POST /api/tests/submit
// @access  Private (Student)
const submitTest = asyncHandler(async (req, res) => {
    const { testId, answers } = req.body;
    const studentId = req.user._id;

    const test = await Test.findById(testId);
    if (!test) {
        res.status(404);
        throw new Error('Test not found');
    }

    let score = 0;
    test.questions.forEach((question, index) => {
        const userAnswerIndex = answers[index];
        if (userAnswerIndex !== null && userAnswerIndex !== undefined && question.correctOption === userAnswerIndex) {
            score++;
        }
    });

    const attempt = await TestAttempt.create({
        student: studentId,
        test: testId,
        score: score,
        answers: answers,
        submitted: true,
    });

    if (attempt) {
        res.status(201).json({
            success: true,
            message: "Test submitted successfully!",
            score: score,
            totalMarks: test.questions.length,
        });
    } else {
        res.status(400);
        throw new Error('Could not save the result');
    }
});

// @desc    Get all results for the logged-in student
// @route   GET /api/tests/results
// @access  Private (Student)
const getTestResults = asyncHandler(async (req, res) => {
    const studentId = req.user._id;
    const results = await TestAttempt.find({ student: studentId })
        .populate('test', 'title')
        .sort({ createdAt: -1 });
    res.status(200).json(results);
});

// @desc    Get details of a single test result by its ID
// @route   GET /api/tests/results/:id
// @access  Private (Student)
const getSingleTestResult = asyncHandler(async (req, res) => {
    const { id: resultId } = req.params;
    const result = await TestAttempt.findById(resultId).populate({ path: 'test', model: 'Test' });

    if (!result) {
        res.status(404);
        throw new Error('Test result not found.');
    }
    if (result.student.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Forbidden: You are not authorized to view this result.');
    }

    res.status(200).json(result);
});

// @desc    Get all results for ALL students (for Admin)
// @route   GET /api/tests/all-results
// @access  Private/Admin
const getAllStudentResults = asyncHandler(async (req, res) => {
    const results = await TestAttempt.find({})
        .populate('test', 'title')
        .populate('student', 'firstName lastName email')
        .sort({ createdAt: -1 });
    res.status(200).json(results);
});

// --- Final and Correct Exports ---
module.exports = {
    createTest,
    getAllTests,
    getTestById,
    getTestsForCourse,
    updateTest,
    deleteTest,
    submitTest,
    getTestResults,
    getSingleTestResult,
    getAllStudentResults,
};