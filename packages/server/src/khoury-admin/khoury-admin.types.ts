export interface KhouryPerson {
  email: string;
  first_name: string;
  last_name: string;
}

export interface SectionGroupsResponse {
  semester: string;
  section_groups: { id: string; name: string; crns: number[] }[];
}

export interface UserCoursesResponse {
  semester: string;
  courses: { section_group_id: string; role: 'Professor' | 'TA' | 'Student' }[];
}

export interface RosterResponse {
  id: string;
  name: string;
  semester: string;
  generated_at: string;
  professors: KhouryPerson[];
  tas: KhouryPerson[];
  sections: { crn: number; students: KhouryPerson[] }[];
}

export class KhouryAdminError extends Error {}
