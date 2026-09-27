-- Migration for Advising Logs schema

CREATE TABLE IF NOT EXISTS public.advising_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    student_matric_no VARCHAR(20) NOT NULL REFERENCES public.students(matric_no) ON DELETE CASCADE,
    advisor_staff_id VARCHAR(50) NOT NULL REFERENCES public.advisors(staff_id) ON DELETE CASCADE,
    session_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT NOT NULL,
    action_item TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.advising_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view their own advisees logs"
ON public.advising_logs FOR SELECT
USING (advisor_staff_id = (SELECT staff_id FROM advisors WHERE user_id = auth.uid()));

CREATE POLICY "Advisors can insert logs for their advisees"
ON public.advising_logs FOR INSERT
WITH CHECK (advisor_staff_id = (SELECT staff_id FROM advisors WHERE user_id = auth.uid()));

CREATE POLICY "Students can view their own logs"
ON public.advising_logs FOR SELECT
USING (student_matric_no = (SELECT matric_no FROM students WHERE user_id = auth.uid()));
