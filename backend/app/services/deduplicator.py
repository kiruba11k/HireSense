def deduplicate_jobs(jobs):

    seen = set()
    output = []

    for job in jobs:

        key = (
            job.company_name.lower(),
            job.job_title.lower(),
            (job.location or "").lower(),
        )

        if key in seen:
            continue

        seen.add(key)
        output.append(job)

    return output


def apply_hiring_spike(jobs):

    company_count = {}

    for j in jobs:
        company_count[j.company_name] = company_count.get(j.company_name, 0) + 1

    for j in jobs:
        if company_count[j.company_name] > 20:
            j.hiring_spike = True

    return jobs
