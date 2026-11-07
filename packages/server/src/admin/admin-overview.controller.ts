import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@koh/common';
import { Response } from 'express';
import { Connection } from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { UserCourseModel } from '../profile/user-course.entity';

// Same session check as nestjs-admin's AdminGuard, but redirects to the admin
// login page instead of returning a bare 401
@Injectable()
export class AdminPageGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.isAuthenticated && request.isAuthenticated()) {
      return true;
    }
    const response: Response = context.switchToHttp().getResponse();
    response.redirect('/admin/login');
    return false;
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Shared page shell. The inline script makes every table.interactive sortable
// by clicking column headers and wires input.table-filter boxes to hide
// non-matching rows (all space-separated terms must match, case-insensitive).
// The script intentionally avoids backticks and ${} so it can live inside
// this TypeScript template literal.
function renderPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/admin-static/css/base.css">
<link rel="stylesheet" href="/admin-static/css/changelist.css">
<style>
  table.interactive th { cursor: pointer; user-select: none; white-space: nowrap; }
  table.interactive th:after { content: ' \\2195'; opacity: .45; }
  table.interactive th[data-dir=asc]:after { content: ' \\2191'; opacity: 1; }
  table.interactive th[data-dir=desc]:after { content: ' \\2193'; opacity: 1; }
  input.table-filter { max-width: 340px; margin: 12px 0 4px; }
  .count-badge { color: #6c757d; font-weight: normal; font-size: 60%; }
  .actions { margin: 12px 0; }
  form.inline { display: inline; margin: 0; }
</style>
</head>
<body>
<nav class="admin-header navbar navbar-dark bg-dark">
  <a class="navbar-brand mb-0 h1" href="/admin">Admin</a>
  <div class="d-flex align-items-center">
    <a class="btn btn-outline-light btn-sm" style="margin-right: 1rem" href="/admin/overview">Courses overview</a>
    <form action="/admin/logout" method="POST" style="margin: 0">
      <button type="submit" class="admin-header__logout">Logout</button>
    </form>
  </div>
</nav>
<div class="container-fluid mt-4 mb-5">
${body}
</div>
<script>
(function () {
  function cellText(row, idx) {
    var cell = row.cells[idx];
    return cell ? cell.innerText.trim() : '';
  }
  document.querySelectorAll('table.interactive').forEach(function (table) {
    var headers = table.querySelectorAll('th');
    headers.forEach(function (th, idx) {
      th.addEventListener('click', function () {
        var dir = th.dataset.dir === 'asc' ? -1 : 1;
        headers.forEach(function (h) { delete h.dataset.dir; });
        th.dataset.dir = dir === 1 ? 'asc' : 'desc';
        var tbody = table.tBodies[0];
        var rows = Array.prototype.slice.call(tbody.rows);
        rows.sort(function (a, b) {
          var ta = cellText(a, idx);
          var tb = cellText(b, idx);
          var na = parseFloat(ta);
          var nb = parseFloat(tb);
          if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
          return ta.localeCompare(tb) * dir;
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    });
  });
  document.querySelectorAll('input.table-filter').forEach(function (input) {
    var table = document.getElementById(input.dataset.table);
    if (!table) return;
    input.addEventListener('input', function () {
      var terms = input.value.toLowerCase().split(/\\s+/).filter(Boolean);
      Array.prototype.slice.call(table.tBodies[0].rows).forEach(function (row) {
        var text = row.innerText.toLowerCase();
        var show = terms.every(function (t) { return text.indexOf(t) !== -1; });
        row.style.display = show ? '' : 'none';
      });
    });
  });
})();
</script>
</body>
</html>`;
}

const ROLE_SECTIONS: { role: Role; heading: string }[] = [
  { role: Role.PROFESSOR, heading: 'Professors' },
  { role: Role.TA, heading: 'TAs' },
  { role: Role.STUDENT, heading: 'Students' },
];

@Controller('admin')
@UseGuards(AdminPageGuard)
export class AdminOverviewController {
  constructor(private connection: Connection) {}

  @Get('overview')
  async overview(@Res() res: Response): Promise<void> {
    res.set('Cache-Control', 'no-store');
    const courses = await this.connection
      .getRepository(CourseModel)
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.semester', 'semester')
      .getMany();
    const counts: { courseId: number; role: Role; count: string }[] =
      await this.connection.query(
        'SELECT "courseId", role, COUNT(*) AS count FROM user_course_model GROUP BY "courseId", role',
      );
    const countsByCourse = new Map<number, Partial<Record<Role, number>>>();
    for (const row of counts) {
      const byRole = countsByCourse.get(row.courseId) ?? {};
      byRole[row.role] = Number(row.count);
      countsByCourse.set(row.courseId, byRole);
    }

    courses.sort((a, b) => {
      const yearDiff = (b.semester?.year ?? 0) - (a.semester?.year ?? 0);
      if (yearDiff !== 0) return yearDiff;
      const seasonDiff = (b.semester?.season ?? '').localeCompare(
        a.semester?.season ?? '',
      );
      if (seasonDiff !== 0) return seasonDiff;
      return a.name.localeCompare(b.name);
    });

    const rows = courses
      .map((course) => {
        const byRole = countsByCourse.get(course.id) ?? {};
        const semester = course.semester
          ? `${course.semester.season} ${course.semester.year}`
          : '—';
        const total =
          (byRole[Role.PROFESSOR] ?? 0) +
          (byRole[Role.TA] ?? 0) +
          (byRole[Role.STUDENT] ?? 0);
        return `<tr>
          <td><a href="/admin/overview/course/${course.id}">${escapeHtml(course.name)}</a></td>
          <td>${escapeHtml(semester)}</td>
          <td>${course.enabled ? 'yes' : 'no'}</td>
          <td>${byRole[Role.PROFESSOR] ?? 0}</td>
          <td>${byRole[Role.TA] ?? 0}</td>
          <td>${byRole[Role.STUDENT] ?? 0}</td>
          <td>${total}</td>
          <td>${course.id}</td>
          <td><a href="/admin/course/coursemodel/${course.id}/change">edit</a></td>
        </tr>`;
      })
      .join('\n');

    const body = `
<div class="crumbs"><a href="/admin">Admin</a> / Courses overview</div>
<h1>Courses overview <span class="count-badge">(${courses.length} courses)</span></h1>
<p class="meta">Click a course for its full roster. Click column headers to sort; type below to filter (e.g. "fall 2025 yes").</p>
<input class="table-filter form-control" data-table="courses-table" placeholder="Filter courses...">
<table id="courses-table" class="table table-bordered table-striped entity-table interactive">
  <thead class="thead-dark"><tr>
    <th>Course</th><th>Semester</th><th>Enabled</th><th>Professors</th><th>TAs</th><th>Students</th><th>Total</th><th>Id</th><th></th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`;
    res.send(renderPage('Courses overview', body));
  }

  @Get('overview/course/:id')
  async courseDetail(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    res.set('Cache-Control', 'no-store');
    const course = await this.connection
      .getRepository(CourseModel)
      .findOne(Number(id), { relations: ['semester'] });
    if (!course) {
      throw new NotFoundException(`No course with id ${id}`);
    }
    const enrollments = await this.connection
      .getRepository(UserCourseModel)
      .createQueryBuilder('uc')
      .leftJoinAndSelect('uc.user', 'user')
      .where('uc.courseId = :id', { id: Number(id) })
      .orderBy('user.lastName', 'ASC')
      .addOrderBy('user.firstName', 'ASC')
      .getMany();

    const sections = ROLE_SECTIONS.map(({ role, heading }) => {
      const members = enrollments.filter((uc) => uc.role === role);
      const tableId = `table-${role}`;
      const rows = members
        .map(
          (uc) => `<tr>
            <td>${escapeHtml(uc.user ? `${uc.user.firstName} ${uc.user.lastName}` : `(deleted user #${uc.userId})`)}</td>
            <td>${escapeHtml(uc.user?.email)}</td>
            <td>${uc.user ? `<a href="/admin/user/usermodel/${uc.user.id}/change">#${uc.user.id}</a>` : '—'}</td>
            <td><a href="/admin/usercourse/usercoursemodel/${uc.id}/change">#${uc.id}</a></td>
            <td>
              <form class="inline" method="POST" action="/admin/usercourse/usercoursemodel/${uc.id}/delete"
                    onsubmit="return confirm(${escapeHtml(JSON.stringify(`Remove ${uc.user ? `${uc.user.firstName} ${uc.user.lastName}` : 'this enrollment'} from ${course.name}?`))})">
                <button class="btn btn-outline-danger btn-sm" type="submit">Remove</button>
              </form>
            </td>
          </tr>`,
        )
        .join('\n');
      return `
<h2>${heading} <span class="count-badge">(${members.length})</span></h2>
<input class="table-filter form-control" data-table="${tableId}" placeholder="Filter ${heading.toLowerCase()}...">
<table id="${tableId}" class="table table-bordered table-striped entity-table interactive">
  <thead class="thead-dark"><tr><th>Name</th><th>Email</th><th>User</th><th>Enrollment</th><th></th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
    }).join('\n');

    const semester = course.semester
      ? `${course.semester.season} ${course.semester.year}`
      : 'no semester';
    const body = `
<div class="crumbs"><a href="/admin">Admin</a> / <a href="/admin/overview">Courses overview</a> / ${escapeHtml(course.name)}</div>
<h1>${escapeHtml(course.name)} <span class="count-badge">(#${course.id})</span></h1>
<p class="meta">${escapeHtml(semester)} · ${course.enabled ? 'enabled' : 'disabled'} · ${enrollments.length} people</p>
<div class="actions">
  <a class="btn btn-outline-secondary btn-sm" href="/admin/usercourse/usercoursemodel/add">Add someone to a course</a>
  <a class="btn btn-outline-secondary btn-sm" href="/admin/course/coursemodel/${course.id}/change">Edit course</a>
</div>
${sections}`;
    res.send(renderPage(`${course.name} roster`, body));
  }
}
