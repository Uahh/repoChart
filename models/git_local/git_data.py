import json
import os
import copy
from collections import defaultdict
from pprint import pprint

class GitData():
    def __init__(self, git_dir=None) -> None:
        self.git_dir = ''
        if git_dir:
            self.git_dir = git_dir
        self.path_list = []
        self.commits_list = []
        self.lines_list = []
        self.size_list = []
        self.url_list = []

    def get_git_path(self, git_dir=None):
        if not git_dir:
            git_dir = self.git_dir
        file_list = os.listdir(git_dir)
        for file in file_list:
            if file == '.git':
                continue
            file_path = os.path.join(git_dir, file)
            if os.path.isfile(file_path):
                # append path
                file_path = file_path.replace('\\', '/')
                self.path_list.append(file_path)

                # append file size
                self.size_list.append(os.path.getsize(file_path))

                # append file url
                file_name = ''
                url_path = file_path.split('/')
                for dir in url_path[3:]:
                    file_name = os.path.join(file_name, dir)
                file_name = file_name.replace('\\', '/')
                url = 'https://github.com/{}/{}/tree/master/{}'.format(
                    url_path[1], url_path[2], file_name)
                self.url_list.append(url)
            elif os.path.isdir(file_path):
                self.get_git_path(file_path)


class ConvertDict():
    def __init__(self, git_data=None) -> None:
        if git_data:
            self.git_data = git_data
        self.load_language_colors()
        self.circle_dict = {}

    # Creates a default dictionary where each value is an other default dictionary.
    def nested_dict(self) -> defaultdict:
        return defaultdict(self.nested_dict)

    # Converts defaultdicts of defaultdicts to dict of dicts.
    def default_to_regular(self, new_path_dict):
        if isinstance(new_path_dict, defaultdict):
            new_path_dict = {k: self.default_to_regular(
                v) for k, v in new_path_dict.items()}
        return new_path_dict

    def get_path_dict(self):
        new_path_dict = self.nested_dict()
        for i in range(0, len(self.git_data.path_list)):
            parts = self.git_data.path_list[i].split('/')
            if parts:
                marcher = new_path_dict
                for key in parts[:-1]:
                    if len(parts) > 3:
                        if '$size' not in marcher.keys():
                            marcher['$size'] = 0
                    marcher = marcher[key]
                marcher['$size'] = self.git_data.size_list[i]
                marcher['$commits'] = self.git_data.commits_list[i]
                marcher['$lines'] = self.git_data.lines_list[i]
                marcher['$url'] = self.git_data.url_list[i]
                marcher['$color'] = self.get_color(parts[-2].split('.')[-1])

                index = len(parts) - 3
                while index > 0:
                    temp_marcher = new_path_dict
                    for key in parts[:-(index + 1)]:
                        temp_marcher = temp_marcher[key]
                    temp_marcher['$size'] += marcher['$size']
                    index -= 1

        self.circle_dict = self.default_to_regular(new_path_dict)['']
        sqare_dict = {
            'value': 0,
            "name": self.git_data.repo_name,
            "path": '',
            'children': []
        }
        self.total_size = 0
        self.sqare_dict = [self.convert_sqare_dict(self.circle_dict, sqare_dict)]

    def convert_sqare_dict(self, circle_dict, sqare_dict):
        dict_template = {
            'value': 0,
            "name": '',
            "path": '',
            'children': []
        }
        for key in circle_dict.keys():
            if key == '$size':
                continue
            d = copy.deepcopy(dict_template)
            d['value'] = circle_dict[key]['$size']
            if '$commits' not in circle_dict[key]:
                d['name'] = key
                d['path'] = sqare_dict['path'] + '/' + key
                d['children'] = []
                sqare_dict['children'].append(d)
                self.convert_sqare_dict(circle_dict[key], d)
            else:
                d['name'] = key
                d['path'] = sqare_dict['path'] + '/' + key
                sqare_dict['children'].append(d)
                self.total_size += d['value']
        sqare_dict['value'] = self.total_size
        return sqare_dict

    def output_dict(self, file_path, file_name):
        if not os.path.exists(file_path):
            os.mkdir(file_path)
        output_path = os.path.join(file_path, file_name)
        with open(output_path + '_circle.json', 'w') as json_file:
            json_file.write(json.dumps(self.circle_dict))
        
        output_path = os.path.join(file_path, file_name)
        with open(output_path + '_square.json', 'w') as json_file:
            json_file.write(json.dumps(self.sqare_dict))

    def load_language_colors(self):
        with open("config/language_colors.json") as json_file:
            self.language_colors = json.load(json_file)

    def get_color(self, file):
        if file in self.language_colors:
            return self.language_colors[file]
        return '#E5E7EB'

# a = GitData('repo_cache/Uahh/Fyzhq')
# a.get_git_path()
# a = 0
