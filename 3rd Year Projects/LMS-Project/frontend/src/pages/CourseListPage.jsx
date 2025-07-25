import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchCourses } from '../api/courses.js';
import { fetchBranches } from '../api/branches.js';
import { fetchMyEnrollments } from '../api/enrollments.js';
import CourseCard from '../components/student/CourseCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

const CourseListPage = () => {
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [enrolledCourseIds, setEnrolledCourseIds] = useState(new Set());
    const [selectedBranch, setSelectedBranch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const query = useQuery();
    // Auth context se token bhi nikalenge
    const { isAuthenticated, currentUser, token } = useAuth();

    const initialBranchId = query.get('branchId');

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            setError('');
            try {
                // Pehle branches aur courses fetch kar lete hain (ye public data hai)
                const branchesData = await fetchBranches();
                setBranches(branchesData || []);

                if (initialBranchId) {
                    setSelectedBranch(initialBranchId);
                }

                const coursesResponse = await fetchCourses(initialBranchId);
                // Ho sakta hai courses bhi seedhe array mein aa rahe hon, isliye dono cases handle kar lete hain
                setCourses(coursesResponse?.data || coursesResponse || []);

                // =======================================================
                //      YAHAN PAR ZAROORI BADLAV KIYA GAYA HAI
                // =======================================================
                // Agar user logged in hai aur student hai, tabhi enrollments fetch karein
                if (isAuthenticated && currentUser?.user?.role === 'student' && token) {
                    // fetchMyEnrollments ko TOKEN pass karna zaroori hai
                    const enrollmentsData = await fetchMyEnrollments(token);
                    const ids = new Set(enrollmentsData.map(e => e.course._id));
                    setEnrolledCourseIds(ids);
                }
            } catch (err) {
                setError('Failed to load course data. Please try again later.');
                console.error("Error loading course list data:", err);
            }
            setLoading(false);
        };

        loadInitialData();
        // dependency array mein 'token' ko bhi add karein
    }, [initialBranchId, isAuthenticated, currentUser, token]);


    const handleBranchChange = (e) => {
        const newBranchId = e.target.value;
        setSelectedBranch(newBranchId);

        const loadCourses = async () => {
            setLoading(true);
            try {
                const coursesResponse = await fetchCourses(newBranchId);
                setCourses(coursesResponse?.data || coursesResponse || []);
            } catch (err) {
                setError('Failed to filter courses.');
            }
            setLoading(false);
        };
        loadCourses();
    };

    const handleEnrollSuccess = (enrolledCourseId) => {
        setEnrolledCourseIds(prevIds => new Set([...prevIds, enrolledCourseId]));
    };

    if (error) return <p style={{color: 'red', textAlign: 'center', marginTop: '20px'}}>{error}</p>;

    return (
        <div className="container">
            <h1>Available Courses</h1>
            <div>
                <label htmlFor="branchFilter" style={{ marginRight: '10px' }}>Filter by Branch:</label>
                <select id="branchFilter" value={selectedBranch} onChange={handleBranchChange}>
                    <option value="">All Branches</option>
                    {branches.map(branch => (
                        <option key={branch._id} value={branch._id}>{branch.name}</option>
                    ))}
                </select>
            </div>

            {loading ? <p style={{textAlign: 'center', marginTop: '20px'}}>Loading courses...</p> : (
                courses.length === 0 ? (
                    <p style={{textAlign: 'center', marginTop: '20px'}}>No courses available for the selected criteria.</p>
                ) : (
                    <div className="courses-grid">
                        {courses.map(course => (
                            <div className="col-md-4 mb-4" key={course._id}>
                                <CourseCard
                                    key={course._id}
                                    course={course}
                                    onEnrollSuccess={handleEnrollSuccess}
                                    isEnrolled={enrolledCourseIds.has(course._id)}
                                />
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
};

export default CourseListPage;