fetch('jobs.json')
    .then(resp => resp.json())
    .then(jobs => {
        const tbody = document.querySelector('#jobs tbody');
        jobs.forEach(job => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${job.cargo}</td><td>${job.departamento}</td><td>${job.prazo}</td>`;
            tbody.appendChild(tr);
        });
    })
    .catch(err => console.error('Erro ao carregar vagas', err));
