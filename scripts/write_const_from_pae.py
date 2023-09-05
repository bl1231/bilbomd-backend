"""
Provides functions to create const.inp file from PAE and CRD files
"""
import sys
import json
import csv
import argparse
from time import time
from collections import defaultdict
import numpy
import igraph
# import networkx as nx


def parse_pae_file(pae_json_file):
    """
    Parses PAE file and returns a Numpy array
    """
    with open(pae_json_file, mode='r', encoding='utf-8') as pae_file:
        data = json.load(pae_file)[0]
    if 'residue1' in data and 'distance' in data:
        # Legacy PAE format, keep for backwards compatibility.
        residue1, distance = data['residue1'], data['distance']
        size = max(residue1)
        matrix = numpy.empty((size, size), dtype=numpy.float64)
        matrix.ravel()[:] = distance
    elif 'predicted_aligned_error' in data:
        # New PAE format.
        matrix = numpy.array(
            data['predicted_aligned_error'], dtype=numpy.float64)
    else:
        raise ValueError('Invalid PAE JSON format.')

    return matrix

def domains_from_pae_matrix_igraph(pae_matrix, pae_power=1, pae_cutoff=5, graph_resolution=1):
    """
    Takes a predicted aligned error (PAE) matrix representing the predicted error in distances
    between each pair of residues in a model, and uses a graph-based community clustering algorithm
    to partition the model into approximately rigid groups.

    Arguments:

        * pae_matrix: a (n_residues x n_residues) numpy array. Diagonal elements should be set to
          some non-zero value to avoid divide-by-zero warnings
        * pae_power (optional, default=1): each edge in the graph will be weighted proportional to
          (1/pae**pae_power)
        * pae_cutoff (optional, default=5): graph edges will only be created for residue pairs with
          pae<pae_cutoff
        * graph_resolution (optional, default=1): regulates how aggressively the clustering
          algorithm is. Smaller values lead to larger clusters. Value should be larger than zero,
          and values larger than 5 are unlikely to be useful.

    Returns:

        A series of lists, where each list contains the indices of residues belonging
        to one cluster.
    """

    # Avoid divide-by-zero by adding a small epsilon value to the denominator
    epsilon = 1e-6  # You can adjust this value based on your specific needs
    weights = 1 / (pae_matrix + epsilon) ** pae_power

    # weights = 1/pae_matrix**pae_power

    igg = igraph.Graph()
    size = weights.shape[0]
    igg.add_vertices(range(size))
    edges = numpy.argwhere(pae_matrix < pae_cutoff)
    sel_weights = weights[edges.T[0], edges.T[1]]
    igg.add_edges(edges)
    igg.es['weight'] = sel_weights

    igg_communities = igg.community_leiden(
        weights='weight', resolution=graph_resolution/100, n_iterations=-1)
    membership = numpy.array(igg_communities.membership)
    igg_clusters = defaultdict(list)
    for idx, cluster in enumerate(membership):
        igg_clusters[cluster].append(idx)
    igg_clusters = list(
        sorted(igg_clusters.values(), key=lambda l: (len(l)), reverse=True))
    return igg_clusters


def is_int(number):
    """
    Checks whether number is an integer
    """
    try:
        int(number)
        return True
    except ValueError:
        return False


def is_float(number):
    """
    Checks whether number is a float
    """
    try:
        float(number)
        return True
    except ValueError:
        return False


def calculate_average(numbers):
    """
    Calculates average of numbers
    """
    if not numbers:
        return None
    return sum(numbers) / len(numbers)


def separate_into_regions(numbers):
    """
    Separate rigid body defined by  PAE  into the rigid domain
    """
    regions = []
    current_region = [numbers[0]]

    for i in range(1, len(numbers)):
        if numbers[i] == numbers[i - 1] + 1:
            current_region.append(numbers[i])
        else:
            regions.append(current_region)
            current_region = [numbers[i]]

    regions.append(current_region)
    return regions


def read_first_residue_number(input_file):
    """
    Returns first residue number
    """
    with open(input_file, mode='r', encoding='utf-8') as infile:
        for line in infile:
            words = line.split()
            if len(words) >= 2 and words[1] == "EXT":
                next_line = next(infile)
                line_crd = next_line.split()
                if len(line_crd) >= 8:
                    return int(line_crd[1])


def calculate_average_bfactor(crd_file, first_resnum, first_resnum_cluster, last_resnum_cluster):
    """
    Calculate average B factor for specific cluster
    """
    average_bfactor = []
    with open(crd_file, mode='r', encoding='utf-8') as file:
        for line in file:
            words = line.split()
            if len(words) >= 10 and is_float(words[9]) and not words[0].startswith('*'):
                if float(words[9]) > 0.0:
                    bfactor = words[9]
                    resnum = words[1]
                    segment = words[7]
                    if bfactor.replace('.', '', 1).isdigit() and int(first_resnum_cluster) + int(first_resnum) <= int(resnum) <= int(last_resnum_cluster) + int(first_resnum):
                        average_bfactor.append(float(bfactor))

    average = calculate_average(average_bfactor)
    return segment, average


def making_const_from_pae(crd_file, cluster_csv_file, output_inp_file):
    """
    Reads the PAE file, defines rigid bodies and rigid domains, assigns average B factor values,
    and writes a const.inp file
    """

    # check the first residue number in CRD file
    first_resnum = read_first_residue_number(crd_file)

    rigid_body_count = 0
    dock_count = 0

    with open(cluster_csv_file, mode='r', newline='') as csvfile, open(output_inp_file, mode='w') as const_file:
        csvreader = csv.reader(csvfile)
        for row in csvreader:
            non_empty_cluster = [word for word in row if word.strip() != '']
            if len(non_empty_cluster) >= 5:
                pairs = []

                numbers = [int(num) for num in non_empty_cluster]
                consecutive_regions = separate_into_regions(numbers)
                for region in consecutive_regions:
                    first_resnum_cluster = region[0]
                    last_resnum_cluster = region[-1]

                    # check which rigid domains are rigid and which are flexible
                    # based on average bfactor
                    segment, average = calculate_average_bfactor(
                        crd_file, first_resnum, first_resnum_cluster, last_resnum_cluster)

                    # print(f"Average of B factor  position: {average}")
                    if average > b_threshold:
                        str1 = str(int(first_resnum_cluster)+int(first_resnum))
                        str2 = str(int(last_resnum_cluster)+int(first_resnum))

                        new_pair = (str1, str2)
                        print(f"p1: {str1} p2: {str2}")
                        pairs.append(new_pair)

                # write const.inp file
                rigid_body_count += 1
                rb_num = 0
                for pair in pairs:
                    start_res = pair[0]
                    end_res = pair[1]
                    if (rigid_body_count == 1):
                        rb_num += 1
                        # print(f"define fixed{rb_num} sele ( resid {start_res}:{end_res} .and. segid {segment} ) end\n")
                        const_file.write(
                            f"define fixed{rb_num} sele ( resid {start_res}:{end_res} .and. segid {segment} ) end\n")
                    elif (rigid_body_count > 1):
                        rb_num += 1
                        # print(f"define rigid{rb_num} sele ( resid {start_res}:{end_res} .and. segid {segment} ) end\n")
                        const_file.write(
                            f"define rigid{rb_num} sele ( resid {start_res}:{end_res} .and. segid {segment} ) end\n")
                if (rb_num > 0 and rigid_body_count == 1):
                    # print("cons fix sele ", end='')
                    const_file.write("cons fix sele ")
                    for number in range(1, rb_num):
                        # print(f"fixed{number} .or. ", end='')
                        const_file.write(f"fixed{number} .or. ")
                    # print (f"fixed{rb_num} end \n")
                    const_file.write(f"fixed{rb_num} end \n")
                    const_file.write("\n")
                elif (rb_num > 0 and rigid_body_count > 1):
                    dock_count = dock_count + 1
                    # print(f"shape desc dock{dock_count} rigid sele ", end='')
                    const_file.write(
                        f"shape desc dock{dock_count} rigid sele ")
                    for number in range(1, rb_num):
                        # print(f"rigid{number} .or. ", end='')
                        const_file.write(f"rigid{number} .or. ")
                    # print (f"rigid{rb_num} end \n")
                    const_file.write(f"rigid{rb_num} end \n")
                    const_file.write("\n")
        # print(f"return \n")
        const_file.write("return\n")
        const_file.write("\n")


# defaults
_defaults = {
    'pae_power':    1.0,
    'pae_cutoff':  8.0,
    'resolution':   0.8,
    'library':      'igraph'
}

# New characters to add
# new_character_beginning = '['
# new_character_end = ']'
# temp_file = 'temp.json'
cluster_file_path = 'cluster.csv'
const_file_path = 'const.inp'
b_threshold = 50.00


if __name__ == '__main__':

    start_time = time()

    parser = argparse.ArgumentParser(
        description='Extract pseudo-rigid domains from an AlphaFold PAE matrix.')
    parser.add_argument('pae_file', type=str,
                        help="Name of the PAE JSON file.")
    # parser.add_argument('pdb_file', type=str, help="Name of the PDB file.")
    parser.add_argument('crd_file', type=str, help="Name of the CRD file.")

    parser.add_argument('--pae_power', type=float, default=_defaults['pae_power'],
                        help=f'Graph edges will be weighted as 1/pae**pae_power. Default: {_defaults["pae_power"]}')
    parser.add_argument('--pae_cutoff', type=float, default=_defaults['pae_cutoff'],
                        help=f'Graph edges will only be created for residue pairs with pae<pae_cutoff. Default: {_defaults["pae_cutoff"]}')
    parser.add_argument('--resolution', type=float, default=_defaults['resolution'],
                        help=f'Higher values lead to stricter (i.e. smaller) clusters. Default: {_defaults["resolution"]}')
    parser.add_argument('--library', type=str, default=_defaults['library'],
                        help=f'Graph library to use. "igraph" is about 40 times faster; "networkx" is pure Python. Default: {_defaults["library"]}')
    args = parser.parse_args()

    # check for properly formated JSON file
    with open(args.pae_file, mode='r', encoding='utf-8') as json_file:
        try:
            json.load(json_file)
        except ValueError as e:
            print(f"PAE JSON File has formatting problems: {e}")
            sys.exit(1)

    pae = parse_pae_file(args.pae_file)
    lib = args.library
    if lib == 'igraph':
        f = domains_from_pae_matrix_igraph
    else:
        f = domains_from_pae_matrix_networkx
    clusters = f(pae, pae_power=args.pae_power,
                 pae_cutoff=args.pae_cutoff, graph_resolution=args.resolution)
    max_len = max([len(c) for c in clusters])
    clusters = [list(c) + ['']*(max_len-len(c)) for c in clusters]
    with open(cluster_file_path, 'wt') as outfile:
        for c in clusters:
            outfile.write(','.join([str(e) for e in c])+'\n')
    end_time = time()
    print(f'Wrote {len(clusters)} clusters to {cluster_file_path}. Biggest cluster contains {max_len} residues. Run time was {end_time-start_time:.2f} seconds.')

    making_const_from_pae(args.crd_file, cluster_file_path, const_file_path)
