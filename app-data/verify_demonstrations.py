"""Verify Step 3 specifications and frozen inputs without fitting models."""
from pathlib import Path
from copy import deepcopy
from collections import deque,Counter
import importlib.util
import hashlib
import json
import math

BASE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('catalog_verifier',BASE/'verify_catalog.py')
cv=importlib.util.module_from_spec(spec);spec.loader.exec_module(cv)
require=cv.require
load=lambda name:json.loads((BASE/name).read_text(encoding='utf-8'))

def route_length(env):
    walls={tuple(p) for p in env['walls']};start=tuple(env['start']);goal=tuple(env['goal'])
    def allowed(p):return 0<=p[0]<env['rows'] and 0<=p[1]<env['columns'] and p not in walls
    require(allowed(start) and allowed(goal),'invalid start or goal')
    q=deque([(start,0)]);seen={start}
    while q:
        p,n=q.popleft()
        if p==goal:return n
        for dr,dc in env['actionDeltas']:
            nxt=(p[0]+dr,p[1]+dc)
            if allowed(nxt) and nxt not in seen:seen.add(nxt);q.append((nxt,n+1))
    raise ValueError('goal is unreachable')

def validate_fixture(data,entry):
    require(data['id']==entry['id'],'fixture ID mismatch')
    if data['kind']=='synthetic-environment':
        require(len(data['actions'])==len(data['actionDeltas'])==4,'invalid action map')
        require(data['reference']['shortestRouteSteps']==route_length(data),'shortest route mismatch')
        require(data['episodeStepLimit']>0,'invalid episode budget')
        return
    X=data['X'];y=data['y'];n=entry['sampleCount'];d=entry['featureCount']
    require(len(X)==n and len(data['rowIds'])==n,'sample count mismatch')
    require(data['rowIds']==list(range(n)),'row IDs invalid')
    require(all(len(row)==d and all(isinstance(v,(int,float)) and math.isfinite(v) for v in row) for row in X),'feature matrix invalid')
    require(len(data['featureNames'])==d,'feature name count mismatch')
    require(y is None or len(y)==n,'target count mismatch')
    require(y is None or all(isinstance(v,(int,float)) and math.isfinite(v) for v in y),'nonfinite target')
    partitions=data['partitions'];all_rows=[]
    for key,rows in partitions.items():
        require(len(rows)==len(set(rows)),'duplicate partition rows')
        require(all(isinstance(i,int) and 0<=i<n for i in rows),'invalid partition row')
        require(len(rows)==entry['partitionCounts'][key],'partition count mismatch')
        all_rows.extend(rows)
    require(sorted(all_rows)==list(range(n)),'partitions overlap or omit rows')
    if entry['targetKind']=='binary':
        require(set(y)=={0,1},'binary labels invalid')
        for rows in partitions.values():require(set(y[i] for i in rows)=={0,1},'a split lost a class')
        require(set(partitions)=={'train','validation','test'},'supervised partition names invalid')
    if entry['targetKind']=='numeric':
        require(y is not None and set(partitions)=={'train','validation','test'},'regression partition policy invalid')
    if entry['targetKind']=='none':
        require(y is None and set(partitions)=={'fit'},'unsupervised fixture has training labels')
    if data['referenceGroups'] is not None:require(len(data['referenceGroups'])==n,'reference group count mismatch')

def validate_plan(plan,catalog,manifest):
    by_id={e['id']:e for e in catalog['entries']}
    sources={s['id'] for s in catalog['sources']}|{s['id'] for s in plan['supportingReferences']}
    dataset_by_id={x['id']:x for x in manifest['datasets']}
    lessons=plan['lessons'];lesson_by_id={l['id']:l for l in lessons}
    require(len(lesson_by_id)==len(lessons)==plan['scope']['selectedLessonCount']==10,'lesson count or IDs invalid')
    selected={l['catalogEntryId'] for l in lessons}
    require(selected=={e['id'] for e in catalog['entries'] if e['demo']['starterCandidate']},'selected set differs from starter set')
    require([l['learnerOrder'] for l in lessons]==list(range(1,11)),'learner sequence invalid')
    require(sorted(l['buildOrder'] for l in lessons)==list(range(1,11)),'build sequence invalid')
    require(plan['scope']['fixtureCount']==len(dataset_by_id)==7,'fixture count invalid')
    require(plan['scope']['runnableDemoCount']==0,'Step 3 claims runnable models')
    wave_rows=[x for wave in plan['releaseWaves'] for x in wave['lessonIds']]
    require(len(wave_rows)==10 and set(wave_rows)==set(lesson_by_id),'release waves omit or duplicate a lesson')
    for l in lessons:
        entry=by_id[l['catalogEntryId']]
        require(l['task'] in entry['tasks'],'unsupported lesson task')
        require(l['primaryDatasetId'] in dataset_by_id,'unknown primary dataset')
        require(l['challengeDatasetId'] is None or l['challengeDatasetId'] in dataset_by_id,'unknown challenge dataset')
        require(set(l['sourceRefs'])<=sources,'unknown technical reference')
        require(l['catalogPrerequisites']==entry['prerequisites'],'prerequisites differ from catalog')
        require(l['status']=='specified-not-implemented','unexpected implementation claim')
        for dep in l['recommendedPriorLessons']:
            require(dep in lesson_by_id and lesson_by_id[dep]['learnerOrder']<l['learnerOrder'],'dependency missing, cyclic, or out of order')
        require(len({s['id'] for s in l['storyboard']})==len(l['storyboard'])==4,'storyboard IDs invalid')
        require(len(l['acceptanceChecks'])>=5,'acceptance checks incomplete')
        expected_params={p['id']:p for p in entry['parameters']}
        require(set(l['catalogParameterIds'])==set(expected_params),'catalog control mapping incomplete')
        resolved=deepcopy(expected_params)
        require(len({p['parameterId'] for p in l['parameterOverrides']})==len(l['parameterOverrides']),'duplicate parameter overrides')
        for change in l['parameterOverrides']:
            key=change['parameterId'];require(key in resolved,'override targets missing parameter')
            parent=expected_params[key]
            require('minimum' not in change or change['minimum']>=parent['minimum'],'override widens lower bound')
            require('maximum' not in change or change['maximum']<=parent['maximum'],'override widens upper bound')
            resolved[key].update({k:v for k,v in change.items() if k!='parameterId'})
        for key,p in resolved.items():
            require(cv.matches(p['default'],p['valueType']),'control default type invalid')
            if p['valueType'] in ('integer','number'):require(p['minimum']<=p['default']<=p['maximum'],'control default outside bounds')
            if p['valueType']=='string':require(p['default'] in p['choices'],'control default outside choices')
        fixture=dataset_by_id[l['primaryDatasetId']]
        if l['task']=='classification':require(fixture['targetKind']=='binary','classification target kind mismatch')
        if l['task']=='regression':require(fixture['targetKind']=='numeric','regression target kind mismatch')
        if l['task'] in ('clustering','dimensionality-reduction'):require(fixture['targetKind']=='none','unlabeled lesson has target labels')
        if l['catalogEntryId']=='pca':require(resolved['n-components']['maximum']<=fixture['featureCount'],'PCA control exceeds fixture dimension')
        if l['catalogEntryId']=='knn':require(resolved['n-neighbors']['maximum']<=fixture['partitionCounts']['train'],'k exceeds training size')
        for p in l['runControls']:
            require(isinstance(p['default'],int) and not isinstance(p['default'],bool),'run control default invalid')
            if 'choices' in p:require(p['default'] in p['choices'],'run control choice invalid')
            else:require(p['minimum']<=p['default']<=p['maximum'],'run control default outside bounds')
    for g in plan['comparisonGroups']:
        require(set(g['catalogEntryIds'])<=selected,'comparison references unselected model')
        require(set(g['datasetIds'])<=set(dataset_by_id),'comparison dataset missing')
        require(all('classification' in by_id[x]['tasks'] for x in g['catalogEntryIds']),'comparison has incompatible task')
    for e in plan['nextCoverage']:
        require(e['catalogEntryId'] in by_id and e['catalogEntryId'] not in selected,'backlog selection invalid')
        require(e['learningType'] in by_id[e['catalogEntryId']]['learningTypes'],'backlog learning type mismatch')

def main():
    plan,catalog,manifest=load('demonstration-plan.json'),load('catalog.json'),load('dataset-manifest.json')
    cv.validate_schema(plan,load('demonstration-plan.schema.json'))
    validate_plan(plan,catalog,manifest)
    fixtures={}
    for e in manifest['datasets']:
        path=(BASE/e['file']).resolve()
        require(path.is_file(),'fixture file missing')
        require(hashlib.sha256(path.read_bytes()).hexdigest()==e['sha256'],'fixture checksum mismatch')
        fixtures[e['id']]=json.loads(path.read_text(encoding='utf-8'))
        validate_fixture(fixtures[e['id']],e)
    brand_path=(BASE/plan['brandManifestFile']).resolve()
    brand=json.loads(brand_path.read_text(encoding='utf-8'))
    require((brand_path.parent/brand['asset']).is_file(),'selected brand asset missing')
    negatives=[]
    def rejected(label,fn):
        try:fn()
        except (ValueError,KeyError):negatives.append(label)
        else:raise ValueError('Invalid fixture accepted: '+label)
    def bad_plan(change):
        bad=deepcopy(plan);change(bad);validate_plan(bad,catalog,manifest)
    rejected('unknown lesson dataset',lambda:bad_plan(lambda p:p['lessons'][0].update(primaryDatasetId='missing')))
    rejected('parameter default beyond bounds',lambda:bad_plan(lambda p:p['lessons'][0]['parameterOverrides'].append({'parameterId':'slope','default':999})))
    rejected('PCA dimension exceeds fixture',lambda:bad_plan(lambda p:p['lessons'][7]['parameterOverrides'][0].update(maximum=3)))
    rejected('future lesson prerequisite',lambda:bad_plan(lambda p:p['lessons'][0]['recommendedPriorLessons'].append('lesson-mlp')))
    rejected('unknown source reference',lambda:bad_plan(lambda p:p['lessons'][0]['sourceRefs'].append('missing')))
    rejected('runnable model claim',lambda:bad_plan(lambda p:p['scope'].update(runnableDemoCount=10)))
    def bad_split():
        e=next(x for x in manifest['datasets'] if x['id']=='two-blobs');bad=deepcopy(fixtures['two-blobs'])
        bad['partitions']['validation'][0]=bad['partitions']['train'][0];validate_fixture(bad,e)
    rejected('overlapping train and validation rows',bad_split)
    def bad_grid():
        e=next(x for x in manifest['datasets'] if x['id']=='grid-route');bad=deepcopy(fixtures['grid-route'])
        bad['walls'].append(bad['goal']);validate_fixture(bad,e)
    rejected('blocked grid goal',bad_grid)
    report={'status':'passed','validatedOn':'2026-10-15','selectedLessonCount':10,'fixtureCount':7,
            'storyboardBeatCount':sum(len(l['storyboard']) for l in plan['lessons']),
            'acceptanceCheckCount':sum(len(l['acceptanceChecks']) for l in plan['lessons']),
            'inputRowCount':sum(e.get('sampleCount',0) for e in manifest['datasets']),
            'shortestGridRouteSteps':fixtures['grid-route']['reference']['shortestRouteSteps'],
            'runnableDemoCount':0,
            'checks':['plan schema subset','selected candidate set','build and learner sequence','prior-lesson links',
                      'catalog parameters and task compatibility','control defaults and contextual bounds','source references',
                      'comparison compatibility','fixture SHA-256 checksums','finite input values','disjoint complete partitions',
                      'binary class coverage in every split','unlabeled input policy','grid reachability','selected brand asset'],
            'negativeFixturesRejected':negatives,
            'limits':'Checks specifications and frozen inputs only. The 50 lesson acceptance checks are requirements for future model and UI implementation, not completed model tests.'}
    (BASE/'demonstration-validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
