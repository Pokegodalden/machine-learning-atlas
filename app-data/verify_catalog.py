"""Validate this package's schema subset and cross-file content invariants.

Run with Python 3. No dependencies or network access are required.
This is a package verifier, not a general-purpose JSON Schema implementation.
"""
from pathlib import Path
from copy import deepcopy
from collections import Counter
import hashlib
import json
import math
import re

BASE = Path(__file__).resolve().parent

def load(name):
    return json.loads((BASE/name).read_text(encoding='utf-8'))

def require(condition,message):
    if not condition:
        raise ValueError(message)

def matches(value,kind):
    if kind=='object': return isinstance(value,dict)
    if kind=='array': return isinstance(value,list)
    if kind=='string': return isinstance(value,str)
    if kind=='boolean': return isinstance(value,bool)
    if kind=='null': return value is None
    if kind=='number': return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)
    if kind=='integer': return isinstance(value,int) and not isinstance(value,bool)
    raise ValueError('Unknown schema type '+str(kind))

def validate_schema(value,schema,root=None,path='$'):
    root = schema if root is None else root
    if '$ref' in schema:
        target=root
        for part in schema['$ref'].removeprefix('#/').split('/'):
            target=target[part]
        return validate_schema(value,target,root,path)
    if 'const' in schema:
        require(value==schema['const'],path+' violates const')
    if 'enum' in schema:
        require(value in schema['enum'],path+' violates enum')
    if 'type' in schema:
        types=schema['type'] if isinstance(schema['type'],list) else [schema['type']]
        require(any(matches(value,t) for t in types),path+' has incorrect type')
    if isinstance(value,dict):
        for key in schema.get('required',[]):
            require(key in value,path+' missing '+key)
        props=schema.get('properties',{})
        if schema.get('additionalProperties') is False:
            require(not set(value)-set(props),path+' has unknown properties')
        for key,child in value.items():
            if key in props:
                validate_schema(child,props[key],root,path+'.'+key)
    elif isinstance(value,list):
        require(len(value)>=schema.get('minItems',0),path+' has too few items')
        if schema.get('uniqueItems'):
            encoded=[json.dumps(x,sort_keys=True,ensure_ascii=False) for x in value]
            require(len(encoded)==len(set(encoded)),path+' has duplicate items')
        for i,child in enumerate(value):
            if 'items' in schema:
                validate_schema(child,schema['items'],root,path+'['+str(i)+']')
    elif isinstance(value,str):
        require(len(value)>=schema.get('minLength',0),path+' string too short')
        if 'pattern' in schema:
            require(re.search(schema['pattern'],value) is not None,path+' violates pattern')
    elif matches(value,'number'):
        require(value>=schema.get('minimum',-math.inf),path+' below minimum')
        require(value<=schema.get('maximum',math.inf),path+' above maximum')

def unique_ids(rows,label):
    ids=[x['id'] for x in rows]
    require(len(ids)==len(set(ids)),label+' has duplicate IDs')
    return set(ids)

def validate_content(catalog,taxonomy,index,check_index=True):
    ids=unique_ids(catalog['entries'],'entries')
    source_ids=unique_ids(catalog['sources'],'sources')
    axis_ids={key:unique_ids(taxonomy[key],key) for key in ['learningTypes','families','tasks','dataTypes','prerequisites','trainingApproaches']}
    require(catalog['scope']['entryCount']==len(ids),'entryCount mismatch')
    expected_starter={'linear-regression','logistic-regression','decision-tree','random-forest','knn','svm','kmeans','pca','mlp','q-learning'}
    starter={e['id'] for e in catalog['entries'] if e['demo']['starterCandidate']}
    require(starter==expected_starter,'starter candidate set changed')
    require(catalog['scope']['starterCandidateCount']==len(starter),'starter count mismatch')
    require(catalog['scope']['runnableDemoCount']==sum(e['demo']['status']=='implemented' for e in catalog['entries']),'runnable count mismatch')
    used=set()
    for e in catalog['entries']:
        prefix=e['id']+': '
        require(e['primaryFamily'] in axis_ids['families'],prefix+'unknown primary family')
        require(set(e['additionalFamilies']) <= axis_ids['families'],prefix+'unknown additional family')
        for field in ['learningTypes','tasks','dataTypes','prerequisites']:
            require(set(e[field]) <= axis_ids[field],prefix+'unknown '+field)
        used.update(e['learningTypes'])
        require(set(e['sources']) <= source_ids,prefix+'unknown source')
        require(set(e['relatedEntries']) <= ids,prefix+'unknown related entry')
        require(e['id'] not in e['relatedEntries'],prefix+'self relationship')
        unique_ids(e['parameters'],prefix+'parameters')
        for p in e['parameters']:
            at=prefix+p['id']+': '
            require(matches(p['default'],p['valueType']),at+'default type differs from valueType')
            expected={'training':'requires-run','prediction':'recompute-output','exploration':'update-scene','sampling':'requires-generation'}
            require(p['updateBehavior']==expected[p['category']],at+'wrong change behavior')
            if p['valueType'] in ['integer','number']:
                require('minimum' in p and 'maximum' in p and 'scale' in p,at+'missing numeric specification')
                require(p['minimum']<=p['default']<=p['maximum'],at+'default outside bounds')
                require(p['minimum']<p['maximum'],at+'invalid bounds')
                require(p['numericInput'] and 'numeric-input' in p['alternativeWidgets'],at+'missing numeric alternative')
                require(p['widget'] in ['slider','dial'],at+'wrong numeric widget')
                if p['scale']=='logarithmic': require(p['minimum']>0,at+'nonpositive logarithmic lower bound')
                if p['valueType']=='integer': require(p['step']==1,at+'integer control must be stepped')
            elif p['valueType']=='string':
                require(p['default'] in p['choices'],at+'default is not a choice')
                require(p['widget']=='dropdown',at+'wrong choice widget')
            elif p['valueType']=='boolean':
                require(p['widget']=='toggle',at+'wrong boolean widget')
    require(used==axis_ids['learningTypes'],'learning-type coverage incomplete')
    require(index['entryCount']==len(ids),'index entry count mismatch')
    if check_index:
        for key,field in [('byLearningType','learningTypes'),('byPrimaryFamily','primaryFamily'),('byTask','tasks'),('byDataType','dataTypes'),('byKind','kind'),('byMethodTag','methodTags')]:
            expected={}
            for e in catalog['entries']:
                values=e[field] if isinstance(e[field],list) else [e[field]]
                for v in values: expected.setdefault(v,[]).append(e['id'])
            require(index[key]==expected,key+' disagrees with entries')
        expected_terms={}
        norm=lambda t:' '.join(t.casefold().replace('-',' ').split())
        for e in catalog['entries']:
            for t in [e['id'],e['name'],*e['aliases']]:
                values=expected_terms.setdefault(norm(t),[])
                if e['id'] not in values: values.append(e['id'])
        require(index['exactTerms']==expected_terms,'search terms disagree with entries')
        require(index['ambiguousTerms']=={k:v for k,v in expected_terms.items() if len(v)>1},'ambiguous terms mismatch')
        require(set(index['exactTerms']['lda'])=={'linear-discriminant-analysis','latent-dirichlet-allocation'},'LDA ambiguity lost')
        require([d['id'] for d in index['searchDocuments']]==[e['id'] for e in catalog['entries']],'search documents disagree with entries')

def main():
    catalog,taxonomy,index=load('catalog.json'),load('taxonomy.json'),load('catalog-index.json')
    catalog_schema,taxonomy_schema=load('catalog.schema.json'),load('taxonomy.schema.json')
    validate_schema(catalog,catalog_schema)
    validate_schema(taxonomy,taxonomy_schema)
    validate_content(catalog,taxonomy,index)
    logo=(BASE/catalog['brand']['logoFile']).resolve()
    manifest_path=(BASE/catalog['brand']['logoManifest']).resolve()
    require(logo.is_file(),'selected logo missing')
    require(logo.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'),'selected logo is not PNG')
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    original=(manifest_path.parent/manifest['sourceAsset']).resolve()
    require(logo.read_bytes()==original.read_bytes(),'selected logo differs from approved concept')
    negatives=[]
    def rejected(label,mutation,target='catalog'):
        bad=deepcopy(catalog if target=='catalog' else index)
        mutation(bad)
        try:
            if target=='catalog':
                validate_schema(bad,catalog_schema)
                validate_content(bad,taxonomy,index)
            else: validate_content(catalog,taxonomy,bad)
        except (ValueError,KeyError): negatives.append(label)
        else: raise ValueError('Negative fixture was accepted: '+label)
    rejected('missing description',lambda c:c['entries'][0].pop('description'))
    rejected('duplicate ID',lambda c:c['entries'][1].update(id=c['entries'][0]['id']))
    rejected('unknown family',lambda c:c['entries'][0].update(primaryFamily='unknown-family'))
    rejected('dangling related entry',lambda c:c['entries'][0]['relatedEntries'].append('missing-entry'))
    rejected('out-of-range numeric default',lambda c:c['entries'][0]['parameters'][0].update(default=999))
    rejected('wrong default type',lambda c:c['entries'][0]['parameters'][0].update(default=True))
    rejected('nonpositive logarithmic minimum',lambda c:c['entries'][2]['parameters'][0].update(minimum=0))
    rejected('wrong update behavior',lambda c:c['entries'][0]['parameters'][0].update(updateBehavior='requires-run'))
    rejected('lost ambiguous alias',lambda i:i['ambiguousTerms'].pop('lda'),target='index')
    rejected('incorrect facet membership',lambda i:i['byLearningType']['supervised'].pop(),target='index')
    report={
        'status':'passed','validatedOn':'2026-10-15','entryCount':len(catalog['entries']),
        'familyCount':len(taxonomy['families']),'sourceCount':len(catalog['sources']),
        'parameterCount':sum(len(e['parameters']) for e in catalog['entries']),
        'entityKinds':dict(Counter(e['kind'] for e in catalog['entries'])),
        'learningTypeCounts':{k:len(v) for k,v in index['byLearningType'].items()},
        'starterCandidateCount':catalog['scope']['starterCandidateCount'],'runnableDemoCount':catalog['scope']['runnableDemoCount'],
        'checks':['catalog schema subset','taxonomy schema subset','unique IDs','taxonomy membership','source references',
                  'related-entry references','parameter defaults and bounds','change behaviors','numeric alternatives',
                  'facet indexes','search terms and ambiguous aliases','starter and runtime status','approved-logo byte equality'],
        'negativeFixturesRejected':negatives,'selectedLogoSha256':hashlib.sha256(logo.read_bytes()).hexdigest(),
        'limits':'Validation covers the schema keywords used by this package and structural/semantic integrity. It does not execute models, implement dataset constraints, or check remote URL availability.'
    }
    (BASE/'catalog-validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
