"""
Provides functions to create const.inp file from PAE and CRD files
"""
import json
import argparse
from collections import defaultdict
import numpy
import igraph


def first_residue_number(crd):
    """
    Returns the first residue from CRD file
    """
    first_resnum = None
    with open(file=crd, mode='r', encoding='utf8') as infile:
        read_next_line = False
        for line in infile:
            if read_next_line:
                line_crd = line.split()
                if len(line_crd) >= 8:
                    first_resnum = line_crd[1]
                read_next_line = False
            words = line.split()
            if len(words) >= 2 and words[1] == "EXT":
                read_next_line = True
    return first_resnum


def last_residue_number(crd):
    with open(crd, 'r') as infile:
        lines = infile.readlines()
        if lines:
            line_crd = lines[-1].split()
            last_resnum = line_crd[1]
    return (last_resnum)


def segment_id(crd, residue):
    with open(crd, 'r') as infile:
        for line in infile:
            words = line.split()
            if len(words) == 10 and words[1] == residue:
                segment_id = words[7]
    return (segment_id)


def define_segments(crd):
    differing_pairs = []
    with open(crd, 'r') as infile:
        current_line = infile.readline().split()  # Read the first line
        line_number = 1
        for line in infile:
            line_number += 1
            next_line = line.split()

            if len(current_line) == 10 and len(next_line) == 10 and current_line[7] != next_line[7]:
                differing_pairs.append(int(current_line[1])-1)
            current_line = next_line  # Move to the next line
    return (differing_pairs)


def corect_first_character(pae, output_file):
    # Open the JSON file in read mode
    with open(pae, 'r') as infile, open(output_file, 'w') as outfile:
        # Read the content of the file as a string
        json_content = infile.read()
        # Check if the string starts with '[{' and ends with '}]'
        if json_content.startswith('[') and json_content.endswith(']'):
            # Remove the first and last characters
            json_content = json_content[1:-1]
            outfile.write(json_content)
        else:
            outfile.write(json_content)


def define_clusters_for_selected_pae(pae, row_start, row_end, col_start, col_end):
    with open(pae, 'r') as json_file:
        data = json.load(json_file)
    if 'pae' in data:
        matrix = data["pae"]
    elif 'predicted_aligned_error' in data:
        matrix = data["predicted_aligned_error"]
    else:
        raise ValueError('Invalid PAE JSON format.')
    selected_matrix = []
    for i, row in enumerate(matrix):
        new_row = []
        for j, value in enumerate(row):
            if int(row_start) <= i <= int(row_end) and int(col_start) <= j <= int(col_end):
                new_row.append(value)
            else:
                new_row.append(30.0)
        selected_matrix.append(new_row)
    selected_data = {"predicted_aligned_error": selected_matrix}

    if 'predicted_aligned_error' in selected_data:
        # New PAE format.
        pae_matrix = numpy.array(
            selected_data['predicted_aligned_error'], dtype=numpy.float64)

    else:
        raise ValueError('Invalid PAE JSON format.')

    pae_power = 1.4
    pae_cutoff = 10
    graph_resolution = 1
    # Avoid divide-by-zero by adding a small epsilon value to the denominator
    epsilon = 1e-6  # You can adjust this value based on your specific needs
    weights = 1 / (pae_matrix + epsilon) ** pae_power

    g = igraph.Graph()
    size = weights.shape[0]
    g.add_vertices(range(size))
    edges = numpy.argwhere(pae_matrix < pae_cutoff)
    sel_weights = weights[edges.T[0], edges.T[1]]
    g.add_edges(edges)
    g.es['weight'] = sel_weights

    vc = g.community_leiden(
        weights='weight', resolution=graph_resolution/100, n_iterations=-1)
    membership = numpy.array(vc.membership)

    clusters = defaultdict(list)
    for i, c in enumerate(membership):
        clusters[c].append(i)
    clusters = list(
        sorted(clusters.values(), key=lambda l: (len(l)), reverse=True))
    return clusters


def is_float(s):
    try:
        float(s)
        return True
    except ValueError:
        return False


def calculate_average_Bfactor(numbers):
    if not numbers:
        return None
    return sum(numbers) / len(numbers)


def separate_into_regions(numbers, chain_segments):
    regions = []
    current_region = [numbers[0]]
    for i in range(1, len(numbers)):
        if (numbers[i] == numbers[i - 1] + 1) and (numbers[i-1] not in chain_segments):
            current_region.append(numbers[i])
        else:
            regions.append(current_region)
            current_region = [numbers[i]]

    regions.append(current_region)
    return regions


def define_rigid_clusters(clusters, crd, first_resnum, chain_segments):
    # define first residue  number
    rigid_body = []
    for row in clusters:
        pairs = []
        if len(row) >= 5:
            numbers = [int(num) for num in row]
            consecutive_regions = separate_into_regions(
                numbers, chain_segments)
            for region in consecutive_regions:
                first_resnum_cluster = region[0]
                last_resnum_cluster = region[-1]
            # check which rigid domains  are rigid and which are flexbible based on avearge  Bfactor
                average_Bfactor = []
                with open(crd, 'r') as infile:
                    for line in infile:
                        words = line.split()
                        if len(words) >= 10 and is_float(words[9]) and not words[0].startswith('*'):
                            if float(words[9]) > 0.0:
                                Bfactor = words[9]
                                resnum = words[1]

                                if Bfactor.replace('.', '', 1).isdigit() and (int(resnum) >= first_resnum_cluster+first_resnum) and (int(resnum) <= last_resnum_cluster+first_resnum):
                                    average_Bfactor.append(float(Bfactor))
                average = calculate_average_Bfactor(average_Bfactor)

                if (average > Btreshold):
                    with open(crd, 'r') as infile:
                        for line in infile:
                            words = line.split()
                            if len(words) >= 10 and is_float(words[9]) and not words[0].startswith('*'):
                                if (int(words[1]) == first_resnum_cluster + first_resnum):
                                    str1 = int(words[8])
                                elif (int(words[1]) == last_resnum_cluster + first_resnum):
                                    str2 = int(words[8])
                                    segid = words[7]

                    new_pair = (str1, str2, segid)
                    pairs.append(new_pair)
            rigid_body.append(pairs)
    # increase the gab inbetween rigid bodies
    rigid_body_optimized = []
    for row in rigid_body:
        pairs_optimized = []
        for pair in row:
            first_residue = pair[0]
            second_residue = pair[1]
            segid = pair[2]

            for row in rigid_body:
                for pair in row:
                    first_residue_b = pair[0]
                    second_residue_b = pair[1]
                    segid_b = pair[2]
                    if int(second_residue)+1 == int(first_residue_b) and segid == segid_b:
                        second_residue = second_residue - 3

            new_pair = (first_residue, second_residue, segid)
            pairs_optimized.append(new_pair)
        rigid_body_optimized.append(pairs_optimized)

    for row in rigid_body_optimized:
        if row:
            pass

    return rigid_body_optimized


def write_const_file(rigid_body, output_file):
    dock_count = 0
    rigid_body_count = 0

    with open(output_file, 'w') as outfile:
        for row in rigid_body:
            rigid_body_count += 1
            p = 0
            n = 0
            for pair in row:
                first_residue = pair[0]
                second_residue = pair[1]
                segment = pair[2]
                if (rigid_body_count == 1):
                    p += 1
                    # print(f"define fixed{p} sele ( resid {first_residue}:{second_residue} .and. segid {segment} ) end\n")
                    outfile.write(
                        f"define fixed{p} sele ( resid {first_residue}:{second_residue} .and. segid {segment} ) end\n")
                    if p == len(row):
                        # print("cons fix sele ", end='')
                        outfile.write("cons fix sele ")
                        for number in range(1, p):
                            # print(f"fixed{number} .or. ", end='')
                            outfile.write(f"fixed{number} .or. ")
                        # print (f"fixed{p} end \n")
                        outfile.write(f"fixed{p} end \n")
                        outfile.write("\n")

                elif (rigid_body_count > 1):
                    n += 1
                    # print(f"define rigid{n} sele ( resid {first_residue}:{second_residue} .and. segid {segment} ) end\n")
                    outfile.write(
                        f"define rigid{n} sele ( resid {first_residue}:{second_residue} .and. segid {segment} ) end\n")
                    if n == len(row):
                        dock_count += 1
                        # print(f"shape desc dock{dock_count} rigid sele ", end='')
                        outfile.write(
                            f"shape desc dock{dock_count} rigid sele ")
                        for number in range(1, n):
                            # print(f"rigid{number} .or. ", end='')
                            outfile.write(f"rigid{number} .or. ")
                        # print (f"rigid{n} end \n")
                        outfile.write(f"rigid{n} end \n")
                        outfile.write("\n")
        # print(f"return \n")
        outfile.write(f"return \n")
        outfile.write("\n")


Btreshold = 50.00
new_character_beginning = '['
new_character_end = ']'
const_file_path = 'const.inp'
cluster_file = 'clusters.csv'
temp_file_json = 'temp.json'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Extract pAE matrix for  interacxtive  region  from an AlphaFold PAE matrix.')
    parser.add_argument('pae_file', type=str,
                        help="Name of the PAE JSON file.")
    parser.add_argument('crd_file', type=str, help="Name of the CRD file.")
    args = parser.parse_args()

    first_residue = first_residue_number(args.crd_file)
    last_residues = last_residue_number(args.crd_file)
    chain_segments = define_segments(args.crd_file)
    selected_rows_start = str(int(first_residue)-1)
    selected_rows_end = str(int(last_residues)-1)
    selected_cols_start = selected_rows_start
    selected_cols_end = selected_rows_end

    corect_first_character(args.pae_file, temp_file_json)

    clusters = define_clusters_for_selected_pae(
        temp_file_json, selected_rows_start, selected_rows_end, selected_cols_start, selected_cols_end)

    rigid_body = define_rigid_clusters(
        clusters, args.crd_file, int(first_residue), chain_segments)
    # print (rigid_body)

    const_file = write_const_file(rigid_body, const_file_path)

    max_len = max(len(c) for c in clusters)
    clusters = [list(c) + [''] * (max_len - len(c))
                for c in clusters if len(c) > 2]

    with open(cluster_file, 'wt') as outfile:
        for c in clusters:
            outfile.write(','.join([str(e) for e in c])+'\n')

    print(
        f'Wrote {len(clusters)} clusters to {cluster_file}. Biggest cluster contains {max_len} residues. ')
    print(f"Wrote const.inp for  {args.crd_file}\n")
